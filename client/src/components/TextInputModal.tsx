import React, { useState, useEffect, useRef } from 'react';

interface TextInputField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'password';
  placeholder?: string;
  value: string;
  required?: boolean;
  validation?: (value: string) => string | null; // Returns error message or null if valid
}

interface TextInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fields: TextInputField[]; // Up to 4 fields
  confirmText?: string;
  onConfirm: (values: Record<string, string>) => void | Promise<void>;
  isLoading?: boolean;
  onFieldChange?: (fieldId: string, value: string) => void;
}

const TextInputModal: React.FC<TextInputModalProps> = ({
  isOpen,
  onClose,
  title,
  fields,
  confirmText = "Confirm",
  onConfirm,
  isLoading = false,
  onFieldChange
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragStartY, setDragStartY] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [screenHeight] = useState(window.innerHeight);
  const modalRef = useRef<HTMLDivElement>(null);

  // Layout calculations - match SingleInputModal pattern
  const layoutConfig = {
    header: 80, // Title area
    padding: 24, // px-6 = 24px on each side
    keypadSpace: 200, // Reserve space like keypad in SingleInputModal
    confirmButton: 60, // Button height + margins
    safeArea: 20, // Safe area for mobile browsers
  };

  const totalFixedHeight = layoutConfig.header + 
                          layoutConfig.keypadSpace + 
                          layoutConfig.confirmButton + 
                          layoutConfig.safeArea;

  const availableContentHeight = screenHeight - totalFixedHeight;
  const contentHeight = Math.max(availableContentHeight, 200); // Minimum 200px for content

  // Initialize values from fields
  useEffect(() => {
    const initialValues: Record<string, string> = {};
    fields.forEach(field => {
      initialValues[field.id] = field.value || '';
    });
    setValues(initialValues);
  }, [fields]);

  // Animation control - match SingleInputModal pattern
  useEffect(() => {
    if (isOpen) {
      setDragOffset(0);
      setIsAnimating(false);
      setErrors({});
      setTimeout(() => {
        setIsAnimating(true);
      }, 50);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  // Validate fields when values change
  useEffect(() => {
    const newErrors: Record<string, string> = {};
    fields.forEach(field => {
      if (field.validation && values[field.id]) {
        const errorMessage = field.validation(values[field.id]);
        if (errorMessage) {
          newErrors[field.id] = errorMessage;
        }
      }
    });
    setErrors(newErrors);
  }, [values, fields]);

  // Close animation function
  const animateClose = () => {
    setIsClosing(true);
    setIsAnimating(false);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  // Touch handlers for drag-to-close
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    
    const touch = e.touches[0];
    setDragStartY(touch.clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const deltaY = touch.clientY - dragStartY;
    
    if (deltaY > 0) {
      setDragOffset(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const closeThreshold = screenHeight * 0.3; // 30% of screen height
    
    if (dragOffset > closeThreshold) {
      animateClose();
    } else {
      setDragOffset(0);
    }
  };

  const handleInputChange = (fieldId: string, value: string) => {
    setValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
    
    if (onFieldChange) {
      onFieldChange(fieldId, value);
    }
  };

  const handleConfirm = async () => {
    if (isLoading) return;
    
    // Validate all required fields
    const newErrors: Record<string, string> = {};
    let hasErrors = false;
    
    fields.forEach(field => {
      const value = values[field.id] || '';
      
      // Check required fields
      if (field.required && !value.trim()) {
        newErrors[field.id] = `${field.label} is required`;
        hasErrors = true;
      }
      
      // Check validation
      if (field.validation && value) {
        const errorMessage = field.validation(value);
        if (errorMessage) {
          newErrors[field.id] = errorMessage;
          hasErrors = true;
        }
      }
    });
    
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }
    
    try {
      await onConfirm(values);
    } catch (error) {
      // Handle error if onConfirm throws
    }
  };

  const isConfirmDisabled = isLoading || 
                           fields.some(field => 
                             field.required && !values[field.id]?.trim()
                           ) ||
                           Object.keys(errors).length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={animateClose}
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className="absolute inset-0 bg-black"
        style={{
          transform: `translateY(${isClosing ? '100%' : isAnimating ? `${dragOffset}px` : '100%'})`,
          transition: isDragging ? 'none' : (isAnimating || isClosing) ? 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)' : 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="px-6 modal-safe-top pb-4">
          <div className="flex items-center justify-between">
            <div className="w-10"></div> {/* Spacer for centering */}
            <h2 className="text-white text-sm font-semibold text-center flex-1">{title}</h2>
            <button
              onClick={animateClose}
              className="text-zinc-400 hover:text-white p-2 w-10 h-10 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col h-full px-6">
          {/* Input Fields Area */}
          <div 
            className="flex flex-col justify-start pt-4" 
            style={{ height: `${contentHeight}px` }}
          >
            <div className="space-y-6 w-full max-w-md mx-auto">
              {fields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <label 
                    htmlFor={field.id}
                    className="block text-sm font-medium text-zinc-400"
                  >
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  
                  <input
                    id={field.id}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={values[field.id] || ''}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all ${
                      errors[field.id] ? 'border-red-500' : 'border-zinc-700'
                    }`}
                    disabled={isLoading}
                  />
                  
                  {errors[field.id] && (
                    <div className="text-red-400 text-sm">
                      {errors[field.id]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Keypad Space - matches SingleInputModal keypad */}
          <div className="mb-3">
            <div className="h-32"></div> {/* 128px height to match keypad area */}
          </div>

          {/* Confirm Button */}
          <div className="mb-4 pb-20 flex justify-center">
            <button
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className="px-8 h-12 bg-white text-black text-base font-medium rounded-lg transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {isLoading ? 'Processing...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextInputModal;
