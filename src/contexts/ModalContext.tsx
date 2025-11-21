import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

interface ModalContextType {
  modalCount: number;
  registerOpen: () => void;
  registerClose: () => void;
}

const ModalContext = createContext<ModalContextType>({
  modalCount: 0,
  registerOpen: () => {},
  registerClose: () => {},
});

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalCount, setModalCount] = useState(0);

  const value = useMemo(() => ({
    modalCount,
    registerOpen: () => setModalCount(prev => prev + 1),
    registerClose: () => setModalCount(prev => Math.max(0, prev - 1)),
  }), [modalCount]);

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModalContext = () => useContext(ModalContext);

/**
 * Hook to automatically register a modal as open/closed based on a boolean state.
 * Usage: useModalRegistry(isMyModalOpen);
 */
export const useModalRegistry = (isOpen: boolean) => {
  const { registerOpen, registerClose } = useModalContext();

  useEffect(() => {
    if (isOpen) {
      registerOpen();
      return () => {
        registerClose();
      };
    }
  }, [isOpen, registerOpen, registerClose]);
};
