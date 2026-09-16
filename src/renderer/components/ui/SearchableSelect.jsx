import React, { Children, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './SearchableSelect.css';

function optionText(children) {
  return Children.toArray(children).map(child => isValidElement(child) ? optionText(child.props.children) : String(child)).join('');
}

function collectOptions(children) {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child)) return [];
    if (child.type !== 'option') return collectOptions(child.props.children);
    const label = optionText(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: !!child.props.disabled }];
  });
}

const normalize = value => value.normalize('NFKC').trim().toLocaleLowerCase();
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// A filter only changes when a matching option is selected, never while typing.
export default function SearchableSelect({ children, value, onValueChange, className = 'form-select', style, disabled, id, 'aria-label': ariaLabel }) {
  const generatedId = useId();
  const inputId = id || `filter-${generatedId}`;
  const listId = `${inputId}-options`;
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({});
  const options = useMemo(() => collectOptions(children), [children]);
  const selected = options.find(option => option.value === String(value ?? ''));
  const label = ariaLabel || options.find(option => option.value === '')?.label || 'Filter';
  const visibleOptions = useMemo(() => {
    const term = normalize(query);
    const rank = option => {
      const text = normalize(option.label);
      if (!term) return option.value === '' ? -1 : 0;
      if (text === term) return 0;
      return text.startsWith(term) ? 1 : 2;
    };
    return options.filter(option => normalize(option.label).includes(term))
      .sort((a, b) => rank(a) - rank(b) || collator.compare(a.label, b.label));
  }, [options, query]);
  const active = visibleOptions[activeIndex];

  const close = () => { setOpen(false); setQuery(''); };
  const startSearch = () => {
    if (disabled || open) return;
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
  };
  const choose = option => {
    if (!option || option.disabled) return;
    close();
    onValueChange(option.value);
  };

  useEffect(() => {
    setActiveIndex(visibleOptions.findIndex(option => !option.disabled));
  }, [visibleOptions]);

  useEffect(() => {
    if (disabled) close();
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = inputRef.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportLeft = viewport?.offsetLeft || 0;
      const viewportHeight = viewport?.height || window.innerHeight;
      const viewportWidth = viewport?.width || window.innerWidth;
      const below = viewportTop + viewportHeight - rect.bottom - 12;
      const above = rect.top - viewportTop - 12;
      const upward = below < 180 && above > below;
      const maxHeight = Math.max(0, Math.min(300, upward ? above : below));
      const width = Math.min(Math.max(rect.width, 240), viewportWidth - 16);
      setPosition({
        width, maxHeight,
        left: Math.max(viewportLeft + 8, Math.min(rect.left, viewportLeft + viewportWidth - width - 8)),
        top: upward ? undefined : rect.bottom + 4,
        bottom: upward ? window.innerHeight - rect.top + 4 : undefined,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('animationend', updatePosition);
    window.addEventListener('transitionend', updatePosition);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    const observer = new ResizeObserver(updatePosition);
    observer.observe(inputRef.current);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('animationend', updatePosition);
      window.removeEventListener('transitionend', updatePosition);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
      observer.disconnect();
    };
  }, [open]);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      menuRef.current?.querySelector(`[data-option-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIndex, query]);

  const handleKeyDown = event => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      if (open) { event.preventDefault(); event.stopPropagation(); close(); }
    } else if (event.key === 'Tab') {
      close();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (open) choose(active);
      else startSearch();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { startSearch(); return; }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      let next = activeIndex;
      for (let count = 0; count < visibleOptions.length; count++) {
        next = (next + direction + visibleOptions.length) % visibleOptions.length;
        if (!visibleOptions[next].disabled) { setActiveIndex(next); break; }
      }
    }
  };

  return (
    <div className="searchable-select" style={{ width: style?.width === 'auto' ? (style.minWidth || 160) : (style?.width || '100%'), minWidth: style?.minWidth, maxWidth: '100%' }}>
      <input
        ref={inputRef} id={inputId} type="text" role="combobox"
        className={`${className} searchable-select-input`}
        style={{ ...style, width: '100%', minWidth: 0, paddingRight: 30 }}
        value={open ? query : (selected?.label || '')}
        placeholder={open ? 'Type to search...' : label}
        aria-label={label} aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-autocomplete="list" aria-haspopup="listbox"
        aria-activedescendant={open && active && !active.disabled ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off" spellCheck={false} disabled={disabled}
        onFocus={startSearch} onClick={startSearch} onBlur={close}
        onChange={event => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      <ChevronDown className="searchable-select-chevron" size={13} aria-hidden="true" />
      {open && createPortal(
        <div ref={menuRef} className="searchable-select-menu" style={position} onMouseDown={event => event.preventDefault()}>
          <div id={listId} role="listbox" aria-label={label}>
            {visibleOptions.map((option, index) => (
              <div key={`${option.value}-${index}`} id={`${listId}-${index}`} role="option"
                aria-selected={option.value === String(value ?? '')} aria-disabled={option.disabled || undefined}
                data-option-index={index}
                className={`searchable-select-option ${index === activeIndex ? 'highlighted' : ''}`}
                onMouseEnter={() => { if (!option.disabled) setActiveIndex(index); }}
                onClick={() => choose(option)}>
                <span>{option.label}</span>
                {option.value === String(value ?? '') && <Check size={13} aria-hidden="true" />}
              </div>
            ))}
          </div>
          {visibleOptions.length === 0 && <div className="searchable-select-empty" role="status">No matches found. Try another search.</div>}
        </div>, document.body
      )}
    </div>
  );
}
