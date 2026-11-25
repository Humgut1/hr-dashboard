document.querySelectorAll('button.mb').forEach(b => b.addEventListener('click', () => {
  const t = b.previousElementSibling.querySelector('table'); t.classList.toggle('open');
  b.textContent = t.classList.contains('open') ? '접기' : b.dataset.more;
}));
// 회사 고르기: 주소 끝에 #칸id&co=회사키 를 붙이면 그 회사로 바로 열린다
document.querySelectorAll('select[data-pick]').forEach(sel => {
  const box = sel.closest('section');
  const show = k => box.querySelectorAll('.panel').forEach(p => { p.hidden = p.dataset.key !== k; });
  const m = location.hash.match(/co=([^&]+)/);
  if (m && [...sel.options].some(o => o.value === decodeURIComponent(m[1]))) sel.value = decodeURIComponent(m[1]);
  show(sel.value);
  sel.addEventListener('change', () => { show(sel.value); history.replaceState(null, '', '#' + box.id + '&co=' + encodeURIComponent(sel.value)); });
});
