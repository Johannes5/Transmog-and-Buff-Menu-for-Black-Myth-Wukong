// A searchable list prompt (a copy of @inquirer/search's behaviour) with one addition: the right
// arrow or Shift+Enter *applies* the highlighted entry through `onApply` and keeps the list open, so
// looks can be tried on one after another without leaving the menu. Enter applies and closes.
import { createPrompt, useState, useKeypress, usePrefix, usePagination, useEffect, useMemo, isDownKey, isEnterKey, isTabKey, isUpKey, Separator, makeTheme } from '@inquirer/core';
import { styleText } from 'node:util';

const pickTheme = {
  icon: { cursor: '>' },
  style: {
    searchTerm: (text) => styleText('cyan', text),
    description: (text) => styleText('cyan', text),
    applied: (text) => styleText('green', text),
    keysHelpTip: (keys) => keys.map(([key, action]) => `${styleText('bold', key)} ${styleText('dim', action)}`).join(styleText('dim', ' • ')),
  },
};

const isSelectable = (item) => !Separator.isSeparator(item) && !item.disabled;
const isApplyKey = (key) => key.name === 'right' || (key.name === 'return' && key.shift) || key.name === 'f5';

/**
 * config: { message, source(term) -> choices, pageSize, onApply?(value) -> string|void }
 * Choices: { name, value, description? } or Separator. Resolves with the chosen value on Enter.
 */
export const pick = createPrompt((config, done) => {
  const { pageSize = 7 } = config;
  const theme = makeTheme(pickTheme, config.theme);
  const [status, setStatus] = useState('idle');
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [applied, setApplied] = useState('');
  const prefix = usePrefix({ status, theme });
  const bounds = useMemo(() => ({ first: results.findIndex(isSelectable), last: results.findLastIndex(isSelectable) }), [results]);
  const [active = bounds.first, setActive] = useState();

  useEffect(() => {
    const list = config.source(searchTerm || undefined).map((c) => (Separator.isSeparator(c) ? c : { value: c.value, name: c.name ?? String(c.value), description: c.description, disabled: c.disabled ?? false }));
    setResults(list);
    setActive(undefined);
  }, [searchTerm]);

  const selected = results[active];

  useKeypress(async (key, rl) => {
    if (isEnterKey(key) && !key.shift && !(config.onApply && selected && selected.value !== '__back__')) {
      // plain Enter: choose and close (in a try-on list only the "- back" entry closes this way)
      if (selected) { setStatus('done'); done(selected.value); } else rl.write(searchTerm);
    } else if ((isApplyKey(key) || isEnterKey(key)) && selected && config.onApply) {
      // Enter, right arrow or Shift+Enter in a try-on list: apply and stay (Windows consoles send
      // Shift+Enter as a plain Enter, so Enter itself has to apply here; Esc or "- back" leaves)
      rl.clearLine(0);
      rl.write(searchTerm);
      const note = await config.onApply(selected.value);
      setApplied(note ?? `applied: ${selected.name}`);
    } else if (isTabKey(key) && selected) {
      rl.clearLine(0);
      rl.write(selected.name);
      setSearchTerm(selected.name);
    } else if (isUpKey(key) || isDownKey(key)) {
      rl.clearLine(0);
      rl.write(searchTerm);
      if ((isUpKey(key) && active !== bounds.first) || (isDownKey(key) && active !== bounds.last)) {
        const offset = isUpKey(key) ? -1 : 1;
        let next = active;
        do next = (next + offset + results.length) % results.length; while (!isSelectable(results[next]));
        setActive(next);
      }
    } else {
      setSearchTerm(rl.line);
      setApplied('');
    }
  });

  const message = theme.style.message(config.message, status);
  const page = usePagination({
    items: results,
    active,
    renderItem({ item, isActive }) {
      if (Separator.isSeparator(item)) return ` ${item.separator}`;
      const color = isActive ? theme.style.highlight : (x) => x;
      return color(`${isActive ? theme.icon.cursor : ' '} ${item.name}`);
    },
    pageSize,
    loop: false,
  });

  if (status === 'done' && selected) return [prefix, message, theme.style.answer(selected.name)].filter(Boolean).join(' ').trimEnd();
  const helpLine = theme.style.keysHelpTip(config.onApply ? [['↑↓', 'navigate'], ['⏎ or →', 'put it on, stay here'], ['Esc', 'back']] : [['↑↓', 'navigate'], ['⏎', 'choose'], ['Esc', 'back']]);
  const header = [prefix, message, theme.style.searchTerm(searchTerm)].filter(Boolean).join(' ').trimEnd();
  const noResults = results.length === 0 && searchTerm !== '' ? theme.style.error('No results found') : '';
  const body = [noResults || page, ' ', selected?.description ? theme.style.description(selected.description) : '', applied ? theme.style.applied(applied) : '', helpLine].filter(Boolean).join('\n').trimEnd();
  return [header, body];
});
