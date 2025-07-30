// hooks/useModal.ts
import { useState, useCallback } from 'react';

export const useModal = () => {
  const [openedModals, setOpenedModals] = useState<Record<string, boolean>>({});

  const openModal = useCallback((modalId: string): void => {
    setOpenedModals(prev => ({
      ...prev,
      [modalId]: true
    }));
  }, []);

  const closeModal = useCallback((modalId?: string): void => {
    if (modalId) {
      setOpenedModals(prev => ({
        ...prev,
        [modalId]: false
      }));
    } else {
      // Si no se especifica un modal, cerrar todos
      setOpenedModals({});
    }
  }, []);

  const isModalOpen = useCallback((modalId: string): boolean => {
    return openedModals[modalId] === true;
  }, [openedModals]);

  return {
    openModal,
    closeModal,
    isModalOpen
  };
};