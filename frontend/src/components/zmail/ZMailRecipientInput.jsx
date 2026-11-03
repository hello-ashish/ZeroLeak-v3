/**
 * ZMailRecipientInput — Tag-style recipient input with autocomplete
 */
import React, { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { searchUsers } from '../../hooks/useZMail.jsx';

export function ZMailRecipientInput({ label, value = [], onChange, placeholder = 'Add recipient...' }) {
    const [inputVal, setInputVal] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef(null);
    const debounceRef = useRef(null);

    const triggerSearch = useCallback(async (q) => {
        if (q.trim().length < 1) { setSuggestions([]); return; }
        try {
            const { users } = await searchUsers(q);
            setSuggestions(users || []);
            setShowSuggestions(true);
        } catch { setSuggestions([]); }
    }, []);

    const handleInput = (e) => {
        const val = e.target.value;
        setInputVal(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => triggerSearch(val), 250);
    };

    const addRecipient = (address) => {
        if (!address) return;
        const normalized = address.toLowerCase().trim();
        if (!value.includes(normalized)) {
            onChange([...value, normalized]);
        }
        setInputVal('');
        setSuggestions([]);
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const removeRecipient = (addr) => {
        onChange(value.filter(v => v !== addr));
    };

    const handleKeyDown = (e) => {
        if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && inputVal.trim()) {
            e.preventDefault();
            addRecipient(inputVal.trim().replace(/,/g, ''));
        }
        if (e.key === 'Backspace' && !inputVal && value.length > 0) {
            removeRecipient(value[value.length - 1]);
        }
        if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    return (
        <div className="zmail-recipient-field">
            {label && <label className="zmail-recipient-label">{label}</label>}
            <div
                className="zmail-recipient-tags"
                onClick={() => inputRef.current?.focus()}
            >
                {value.map(addr => (
                    <span key={addr} className="zmail-tag">
                        {addr}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeRecipient(addr); }}
                            aria-label={`Remove ${addr}`}
                            className="zmail-tag-remove"
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}
                <div className="zmail-recipient-input-wrap">
                    <input
                        ref={inputRef}
                        className="zmail-recipient-input"
                        type="text"
                        value={inputVal}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        placeholder={value.length === 0 ? placeholder : ''}
                        aria-label={label || placeholder}
                        autoComplete="off"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="zmail-autocomplete" role="listbox">
                            {suggestions.map(u => (
                                <button
                                    key={u.address}
                                    className="zmail-autocomplete-item"
                                    type="button"
                                    role="option"
                                    onMouseDown={() => addRecipient(u.address)}
                                    aria-selected={value.includes(u.address)}
                                >
                                    <span className="zmail-autocomplete-name">{u.name}</span>
                                    <span className="zmail-autocomplete-address">{u.address}</span>
                                    {u.role && <span className="zmail-autocomplete-role">{u.role}</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
