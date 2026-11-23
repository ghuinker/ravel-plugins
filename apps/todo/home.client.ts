// The Tasks card on Home: a task typed into its add field shows at once at the top of the table; the server places it and the card redraws.
type Page = typeof globalThis & { bentoAddTask?: (text: string) => void };

(globalThis as Page).bentoAddTask = (text) => {
  const table = document.querySelector('.h2-addwrap ~ .h2-table');
  if (!table) return;
  const row = document.createElement('div');
  row.className = 'h2-row h2-task h2-new';
  row.style.setProperty('--n', '0');
  const mark = document.createElement('input');
  mark.type = 'checkbox';
  mark.className = 't-check';
  mark.disabled = true;
  const name = document.createElement('span');
  name.className = 'h2-name';
  name.innerHTML = '<b></b>';
  name.firstChild!.textContent = text;
  const chip = document.createElement('span');
  chip.className = 'h2-chip';
  chip.textContent = 'Unsorted';
  const due = document.createElement('span');
  due.className = 'h2-hide';
  row.append(mark, name, due, chip, document.createElement('span'));
  table.querySelector('.h2-th')?.after(row);
};
