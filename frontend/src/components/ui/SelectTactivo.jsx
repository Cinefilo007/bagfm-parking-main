import React from 'react';
import Select from 'react-select';

const SelectTactivo = ({ options, value, onChange, placeholder, label, icon, isLoading, isDisabled, ...props }) => {
  // Estilos personalizados para integrarse con Aegis Tactical v3
  const customStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'var(--bg-low)',
      borderColor: state.isFocused ? 'var(--primary)' : 'var(--bg-high)',
      borderRadius: '10px',
      padding: '4px 8px',
      boxShadow: state.isFocused ? '0 0 0 1px var(--primary)' : 'none',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      '&:hover': {
        borderColor: state.isFocused ? 'var(--primary)' : 'var(--text-muted)',
        backgroundColor: 'var(--bg-card)',
      },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0 4px',
    }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--text-main)',
      fontSize: '0.875rem',
      fontWeight: '500',
    }),
    placeholder: (base) => ({
      ...base,
      color: 'var(--text-muted)',
      fontSize: '0.875rem',
      opacity: 0.6,
    }),
    input: (base) => ({
      ...base,
      color: 'var(--text-main)',
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--bg-card)',
      borderRadius: '12px',
      border: '1px solid var(--bg-high)',
      boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
      overflow: 'hidden',
      padding: '4px',
      zIndex: 50,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected 
        ? 'var(--primary)' 
        : state.isFocused 
          ? 'var(--bg-high)' 
          : 'transparent',
      color: state.isSelected ? 'var(--on-primary)' : 'var(--text-main)',
      borderRadius: '8px',
      fontSize: '0.875rem',
      margin: '2px 0',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      '&:active': {
        backgroundColor: 'var(--primary-dark)',
      },
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? 'var(--primary)' : 'var(--text-muted)',
      '&:hover': {
        color: 'var(--primary)',
      },
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: 'var(--text-muted)',
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }),
    loadingIndicator: (base) => ({
      ...base,
      color: 'var(--primary)',
    }),
  };

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="text-[10px] uppercase font-black text-text-muted tracking-[0.2em] px-1 flex items-center gap-2 mb-1">
          {icon} {label}
        </label>
      )}
      <Select
        styles={customStyles}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder || 'Seleccionar...'}
        isLoading={isLoading}
        isDisabled={isDisabled}
        noOptionsMessage={() => "No hay resultados"}
        loadingMessage={() => "Cargando..."}
        classNamePrefix="tactivo-select"
        {...props}
      />
    </div>
  );
};

export default SelectTactivo;
