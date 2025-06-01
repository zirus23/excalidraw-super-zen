const UI_SELECTORS = [
  "[class*='App-menu']",
  "[class*='z-sidebar']",
  "[class*='App-top-bar']",
  "[class*='App-bottom-bar']",
  "[class*='App-toolbar']",
  "[class*='App-toolbar-container']",
  "[class*='Island']",
  "[class*='FixedSideContainer']",
  "[class*='Stack_vertical']",
  "[class*='Stack_horizontal']"
];

const STORAGE_KEY = "excalidraw_ui_hidden";
let uiHidden = false;
let knownElements = new Set();

// Inject CSS once
function injectZenStyles() {
  if (document.getElementById("super-zen-style")) return;

  const style = document.createElement("style");
  style.id = "super-zen-style";
  style.textContent = `
    .super-zen-hide {
      display: none !important;
    }
    .super-zen-shortcuts .HelpDialog__island-title {
      color: #f7c873 !important;
    }
  `;
  document.head.appendChild(style);
}

// Reapply hiding to any matching elements not already hidden
function reapplyHiding() {
  if (!uiHidden) return;

  UI_SELECTORS.forEach(selector => {
    const matches = document.querySelectorAll(selector);
    matches.forEach(el => {
      if (!knownElements.has(el)) {
        el.classList.add("super-zen-hide");
        knownElements.add(el);
      }
    });
  });
}

// Remove hiding from all matching elements
function removeAllZenHiding() {
  UI_SELECTORS.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.classList.remove("super-zen-hide");
    });
  });
  knownElements.clear();
}

// Save state
function saveState(hidden) {
  chrome.storage.sync.set({ [STORAGE_KEY]: hidden });
}

// Sync changes from other tabs
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes[STORAGE_KEY]) {
    const shouldHide = changes[STORAGE_KEY].newValue;
    if (shouldHide !== uiHidden) {
      uiHidden = shouldHide;
      if (uiHidden) {
        reapplyHiding();
      } else {
        removeAllZenHiding();
      }
    }
  }
});

// On tab activation, re-sync state
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      const shouldHide = !!result[STORAGE_KEY];
      if (shouldHide !== uiHidden) {
        uiHidden = shouldHide;
        if (uiHidden) {
          reapplyHiding();
        } else {
          removeAllZenHiding();
        }
      }
    });
  }
});

// Keyboard shortcut
window.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");

  const isToggle =
    (isMac && e.metaKey && e.shiftKey && e.code === "KeyB") ||
    (!isMac && e.ctrlKey && e.shiftKey && e.code === "KeyB");

  if (isToggle) {
    e.preventDefault();
    uiHidden = !uiHidden;

    if (uiHidden) {
      reapplyHiding();
    } else {
      removeAllZenHiding();
    }

    saveState(uiHidden);
  }
});

// On load: restore state and start the loop
chrome.storage.sync.get([STORAGE_KEY], (result) => {
  uiHidden = !!result[STORAGE_KEY];
  injectZenStyles();

  // Tick loop that collects and hides new UI matches
  setInterval(() => {
    if (uiHidden) reapplyHiding();
  }, 300);
});


// --- SUPER ZEN SHORTCUTS INJECTION ---

const superZenShortcuts = [
  { key: "Shift + / or ?", desc: "Help/Cheatsheet" },
  { key: "CMD + Shift + B", desc: "Super Zen (UI Toggle)" },
  { key: "T", desc: "Text" },
  { key: "Esc", desc: "Deselect (Mouse tool)" },
  { key: "R", desc: "Rectangle" },
  { key: "5", desc: "Arrow" },
  { key: "6", desc: "Line" },
  { key: "S", desc: "Color Picker" },
  { key: "S -> B", desc: "Color Red" },
  { key: "CMD + Shift + < / >", desc: "Decrease/Increase Text Size" },
];

function renderShortcutKeys(key) {
  // Split on 'or' for alternatives
  const alternatives = key.split(/\s+or\s+/i);
  return alternatives
    .map((alt, altIdx) => {
      // Split on '->' for sequences
      const sequences = alt.split('->').map(s => s.trim());
      const seqHtml = sequences
        .map((combo) => {
          // Split on '+' for combos
          const keys = combo.split('+').map(k => k.trim());
          let html = '';
          for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            // If key is a separator (e.g. " < / > "), split and render as kbd / kbd
            if (/^.+\s\/\s.+$/.test(k)) {
              // e.g. "< / >"
              const [left, right] = k.split(/\s\/\s/);
              html += `<kbd class="HelpDialog__key">${left}</kbd> / <kbd class="HelpDialog__key">${right}</kbd>`;
            } else {
              html += `<kbd class="HelpDialog__key">${k}</kbd>`;
            }
            if (i < keys.length - 1) html += ' + ';
          }
          return html;
        })
        .join(' → ');
      // Add " or " between alternatives
      if (altIdx < alternatives.length - 1) {
        return seqHtml + ' or ';
      }
      return seqHtml;
    })
    .join('');
}

function injectSuperZenShortcuts() {
  const dialog = document.querySelector(".Island .Dialog__content");
  if (!dialog) return;

  // Prevent double-injection
  if (dialog.querySelector(".super-zen-shortcuts")) return;

  // Find the Keyboard Shortcuts heading and container
  const h3 = dialog.querySelector("h3");
  const islandsContainer = dialog.querySelector(
    ".HelpDialog__islands-container"
  );
  if (!h3 || !islandsContainer) return;

  // Build the Super Zen shortcuts section
  const section = document.createElement("div");
  section.className = "HelpDialog__island super-zen-shortcuts";
  section.style.cssText = `
    margin-bottom: 24px;
    max-width: 480px;
  `;

  section.innerHTML = `
    <h3 class="HelpDialog__island-title" style="color:#f7c873; font-size: 1.5em; font-weight: bold; margin-bottom: 16px;">
      Essential Shortcuts
    </h3>
    <p style="margin-bottom: 8px;">Most common shortcuts to know to avoid using the GUI most of the time.</p>
    <div style="font-size: 0.95em; color: #888; margin-bottom: 4px;">
      Recommended by Swarnim Kalden, creator of Super Zen.
    </div>
    <div class="HelpDialog__island-content">
      ${superZenShortcuts
        .map(
          (s) => `
        <div class="HelpDialog__shortcut">
          <div>${s.desc}</div>
          <div class="HelpDialog__key-container">
            ${renderShortcutKeys(s.key)}
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  // Change "Keyboard shortcuts" to "All Keyboard Shortcuts"
  if (h3.textContent.trim() === "Keyboard shortcuts") {
    h3.textContent = "All Keyboard Shortcuts";
  }

  // Move the h3 and islandsContainer after the recommended section
  dialog.insertBefore(section, h3);
  dialog.insertBefore(h3, islandsContainer);
}

// Observe for the help dialog opening
const superZenObserver = new MutationObserver(() => {
  injectSuperZenShortcuts();
});

// Start observing the body for added nodes (help dialog is dynamically added)
superZenObserver.observe(document.body, { childList: true, subtree: true });
