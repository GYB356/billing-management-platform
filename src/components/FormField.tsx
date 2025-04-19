import React from 'react';
import { useField } from 'formik';
import classNames from 'classnames';

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'textarea' | 'select';
  placeholder?: string;
  className?: string;
  options?: { label: string; value: string | number }[];
  required?: boolean;
  disabled?: boolean;
  help?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  type = 'text',
  className,
  options,
  required,
  disabled,
  help,
  ...props
}) => {
  const [field, meta] = useField(props);
  const hasError = meta.touched && meta.error;

  const inputClasses = classNames(
    'mt-1 block w-full rounded-md shadow-sm',
    {
      'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500': !hasError,
      'border-red-300 focus:border-red-500 focus:ring-red-500': hasError
    },
    className
  );

  const renderInput = () => {
    switch (type) {
      case 'textarea':
        return (
          <textarea
            {...field}
            {...props}
            className={inputClasses}
            disabled={disabled}
          />
        );
      case 'select':
        return (
          <select
            {...field}
            {...props}
            className={inputClasses}
            disabled={disabled}
          >
            <option value="">Select an option</option>
            {options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      default:
        return (
          <input
            type={type}
            {...field}
            {...props}
            className={inputClasses}
            required={required}
            disabled={disabled}
          />
        );
    }
  };

  return (
    <div className="space-y-1">
      <label
        htmlFor={props.name}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderInput()}
      {hasError ? (
        <p className="mt-1 text-sm text-red-600">{meta.error}</p>
      ) : help ? (
        <p className="mt-1 text-sm text-gray-500">{help}</p>
      ) : null}
    </div>
  );
}; 