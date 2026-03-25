/**
 * Portfolio client logic: theme persistence, hero tagline animation,
 * reviews fetch/render, and review modal with validation + API calls.
 * Uses relative URLs so the same Express server can serve API + static files.
 */

(function () {
  "use strict";

  /** Base path for the reviews API (same origin when served via server.js) */
  const API_REVIEWS = "/api/reviews";

  /** localStorage key for dark/light preference */
  const THEME_KEY = "raghav-portfolio-theme";

  /** Full tagline text typed in the hero */
  const TAGLINE_TEXT =
    "Building scalable apps · exploring cloud, DevOps & full-stack craft.";

  // --- DOM references ---
  const themeToggle = document.getElementById("themeToggle");
  const html = document.documentElement;
  const taglineEl = document.getElementById("tagline");
  const yearEl = document.getElementById("year");
  const reviewsList = document.getElementById("reviewsList");
  const reviewsStatus = document.getElementById("reviewsStatus");
  const openReviewModal = document.getElementById("openReviewModal");
  const modal = document.getElementById("reviewModal");
  const modalBackdrop = document.getElementById("modalBackdrop");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const reviewForm = document.getElementById("reviewForm");
  const reviewName = document.getElementById("reviewName");
  const reviewComment = document.getElementById("reviewComment");
  const commentError = document.getElementById("commentError");
  const formError = document.getElementById("formError");
  const formSuccess = document.getElementById("formSuccess");
  const submitReview = document.getElementById("submitReview");
  const submitSpinner = document.getElementById("submitSpinner");
  const btnText = submitReview ? submitReview.querySelector(".btn__text") : null;

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  // --- Theme: read from localStorage, default light; toggle updates DOM + storage ---
  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    html.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }

  function initTheme() {
    const stored = getStoredTheme();
    if (stored === "dark" || stored === "light") {
      applyTheme(stored);
      return;
    }
    const prefersDark = window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  function toggleTheme() {
    const current = html.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }
  initTheme();

  // --- Hero: simple typewriter for tagline; remove caret blink when finished ---
  function runTaglineAnimation() {
    if (!taglineEl) return;
    const reduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      taglineEl.textContent = TAGLINE_TEXT;
      taglineEl.classList.add("hero__tagline--done");
      return;
    }
    taglineEl.textContent = "";
    let i = 0;
    window.setTimeout(() => {
      const tick = window.setInterval(() => {
        if (i <= TAGLINE_TEXT.length) {
          taglineEl.textContent = TAGLINE_TEXT.slice(0, i);
          i += 1;
        } else {
          window.clearInterval(tick);
          taglineEl.classList.add("hero__tagline--done");
        }
      }, 32);
    }, 400);
  }
  runTaglineAnimation();

  // --- Scroll: fade sections in when they enter the viewport ---
  const animatedSections = document.querySelectorAll(".section-animate");
  if (animatedSections.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { root: null, threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    animatedSections.forEach((el) => io.observe(el));
  } else {
    animatedSections.forEach((el) => el.classList.add("is-visible"));
  }

  // --- Relative time (e.g. "2 hours ago") ---
  function formatRelativeTime(isoOrDate) {
    const then = new Date(isoOrDate).getTime();
    const now = Date.now();
    const sec = Math.round((now - then) / 1000);
    if (Number.isNaN(sec) || sec < 0) return "just now";
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return min === 1 ? "1 minute ago" : `${min} minutes ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return day === 1 ? "1 day ago" : `${day} days ago`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return mo === 1 ? "1 month ago" : `${mo} months ago`;
    const yr = Math.floor(day / 365);
    return yr === 1 ? "1 year ago" : `${yr} years ago`;
  }

  // --- Reviews: fetch JSON with { success, data, message }; handle network errors ---
  async function fetchReviews() {
    if (!reviewsList || !reviewsStatus) return;
    reviewsStatus.textContent = "Loading reviews…";
    reviewsList.innerHTML = "";

    let res;
    try {
      res = await fetch(API_REVIEWS, { headers: { Accept: "application/json" } });
    } catch {
      reviewsStatus.textContent =
        "Could not reach the server. Check your connection and try again.";
      reviewsList.innerHTML =
        '<li class="reviews__empty" role="presentation">Reviews unavailable offline.</li>';
      return;
    }

    let payload;
    try {
      payload = await res.json();
    } catch {
      reviewsStatus.textContent = "Invalid response from server.";
      return;
    }

    if (!res.ok || !payload.success) {
      reviewsStatus.textContent =
        (payload && payload.message) || `Something went wrong (${res.status}).`;
      reviewsList.innerHTML =
        '<li class="reviews__empty" role="presentation">No reviews to show.</li>';
      return;
    }

    reviewsStatus.textContent = "";
    const items = Array.isArray(payload.data) ? payload.data : [];

    if (items.length === 0) {
      reviewsList.innerHTML =
        '<li class="reviews__empty" role="presentation">No reviews yet — be the first.</li>';
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach((rev) => {
      const li = document.createElement("li");
      li.className = "review-card";
      const name = document.createElement("p");
      name.className = "review-card__name";
      name.textContent = rev.name || "Anonymous";
      const time = document.createElement("p");
      time.className = "review-card__time";
      time.textContent = formatRelativeTime(rev.createdAt);
      const comment = document.createElement("p");
      comment.className = "review-card__comment";
      comment.textContent = rev.comment || "";
      li.appendChild(name);
      li.appendChild(time);
      li.appendChild(comment);
      frag.appendChild(li);
    });
    reviewsList.appendChild(frag);
  }

  // --- Modal: open/close with CSS class for fade + scale ---
  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    modal.removeAttribute("hidden");
    modal.setAttribute("aria-hidden", "false");
    // Double rAF so the browser paints `display:flex` before toggling `.is-open`
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        modal.classList.add("is-open");
      });
    });
    if (closeModalBtn) closeModalBtn.focus();
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    // Match CSS transition duration so display:none applies after fade-out
    window.setTimeout(() => {
      if (!modal.classList.contains("is-open")) {
        modal.hidden = true;
        modal.setAttribute("hidden", "");
      }
    }, 320);
  }

  function resetFormMessages() {
    if (commentError) {
      commentError.hidden = true;
      commentError.textContent = "";
    }
    if (formError) {
      formError.hidden = true;
      formError.textContent = "";
    }
    if (formSuccess) {
      formSuccess.hidden = true;
      formSuccess.textContent = "";
    }
  }

  function setLoading(isLoading) {
    if (!submitReview) return;
    submitReview.disabled = isLoading;
    if (btnText) btnText.hidden = isLoading;
    if (submitSpinner) submitSpinner.hidden = !isLoading;
  }

  if (openReviewModal) {
    openReviewModal.addEventListener("click", () => {
      resetFormMessages();
      if (reviewForm) reviewForm.reset();
      openModal();
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", closeModal);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  // --- Submit review: validate comment, POST JSON, show spinner + success/error ---
  if (reviewForm) {
    reviewForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      resetFormMessages();

      const nameVal = reviewName && reviewName.value.trim();
      const commentVal = reviewComment && reviewComment.value.trim();

      if (!commentVal) {
        if (commentError) {
          commentError.textContent = "Please enter a comment.";
          commentError.hidden = false;
        }
        if (reviewComment) reviewComment.focus();
        return;
      }

      setLoading(true);
      let res;
      try {
        res = await fetch(API_REVIEWS, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: nameVal || undefined,
            comment: commentVal,
          }),
        });
      } catch {
        setLoading(false);
        if (formError) {
          formError.textContent = "❌ Network error. Could not reach the server.";
          formError.hidden = false;
        }
        return;
      }

      let payload;
      try {
        payload = await res.json();
      } catch {
        setLoading(false);
        if (formError) {
          formError.textContent = "❌ Invalid response from server.";
          formError.hidden = false;
        }
        return;
      }

      setLoading(false);

      if (!res.ok || !payload.success) {
        if (formError) {
          formError.textContent = `❌ ${payload.message || "Could not save your review."}`;
          formError.hidden = false;
        }
        return;
      }

      if (formSuccess) {
        formSuccess.textContent = "✅ Thanks! Your review was posted.";
        formSuccess.hidden = false;
      }
      if (reviewForm) reviewForm.reset();

      window.setTimeout(() => {
        closeModal();
        resetFormMessages();
        fetchReviews();
      }, 1500);
    });
  }

  // Initial load of reviews
  fetchReviews();
})();
