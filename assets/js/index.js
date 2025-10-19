document.addEventListener('DOMContentLoaded', () => {
  ParseratorCommon.initCore();

  const previewButtons = document.querySelectorAll('[data-preview-toggle]');

  previewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('[data-build-card]');
      if (!card) return;
      const preview = card.querySelector('[data-preview-frame]');
      if (!preview) return;

      const isOpen = card.classList.toggle('is-previewing');
      if (isOpen) {
        preview.removeAttribute('hidden');
        button.textContent = 'Hide inline preview';
      } else {
        preview.setAttribute('hidden', '');
        button.textContent = 'Show inline preview';
      }
    });
  });
});
