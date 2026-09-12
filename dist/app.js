const modules = [...document.querySelectorAll('.module')];
const search = document.querySelector('input');
const dialog = document.querySelector('dialog');
let lastModule;
function reset() {
  search.value = '';
  modules.forEach(module => { module.hidden = false; module.classList.remove('selected'); });
  document.querySelector('.empty').hidden = true;
  if (dialog.open) dialog.close();
}
search.addEventListener('input', () => {
  const query = search.value.trim();
  modules.forEach(module => { module.hidden = !module.getAttribute('aria-label').includes(query); });
  document.querySelector('.empty').hidden = modules.some(module => !module.hidden);
});
document.querySelector('.reset').addEventListener('click', reset);
modules.forEach(module => {
  module.addEventListener('click', () => {
    window.TerminalAudio.play('module');
    if (module.dataset.module === 'repair') { window.RepairGame.open(); return; }
    if (module.dataset.module === 'salvage') { window.SalvageGame.open(); return; }
    lastModule = module;
    module.classList.add('selected');
    dialog.querySelector('h2').textContent = module.getAttribute('aria-label');
    dialog.querySelector('p').textContent = module.dataset.module === 'upcoming' ? '更多模拟项目，敬请期待。' : '模拟模块正在准备中，敬请期待。';
    dialog.showModal();
  });
  module.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const visible = modules.filter(item => !item.hidden);
    visible[(visible.indexOf(module) + (event.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length].focus();
  });
});
dialog.addEventListener('close', () => { lastModule?.classList.remove('selected'); lastModule?.focus(); });
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !dialog.open) reset(); });
