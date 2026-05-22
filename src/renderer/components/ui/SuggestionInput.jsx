import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function SuggestionInput({ label, value, onChange, suggestions, field, placeholder, disabled, onDelete, error, required }) {
  const [show, setShow] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const [isFocused, setIsFocused] = useState(false);

  const isFilled = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (typeof val === 'number') return val >= 0;
    return !!val;
  };

  useEffect(() => {
    if (!value || (isFocused && suggestions.includes(value))) {
      setFiltered(suggestions);
    } else {
      setFiltered(suggestions.filter(s => s?.toLowerCase().includes(value?.toLowerCase() || '')));
    }
  }, [value, suggestions, isFocused]);

  return (
    <div className="form-group" style={{ position: 'relative', flex: 1 }}>
      {label && <label className="form-label">{label} {required ? '*' : ''}</label>}
      <div style={{ position: 'relative' }}>
        <input 
          className={`form-input ${error ? 'error' : (isFilled(value) ? 'filled' : '')}`} 
          value={value || ''} 
          onChange={e => {
            onChange(e.target.value);
            setShow(true);
          }} 
          onFocus={() => {
            setShow(true);
            setIsFocused(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              setShow(false);
              setIsFocused(false);
            }, 200);
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {show && filtered?.length > 0 && (
          <div className="custom-suggestions" onMouseDown={e => e.preventDefault()}>
            {filtered.map((s, i) => (
              <div 
                key={i} 
                className={`suggestion-item ${s === value ? 'active' : ''}`} 
                onClick={() => {
                  onChange(s);
                  setShow(false);
                }}
              >
                <span>{s}</span>
                {onDelete && (
                  <button 
                    className="btn-delete-suggestion" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(field, s);
                    }}
                    type="button"
                    title="Remove suggestion"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
