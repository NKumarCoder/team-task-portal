'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { X } from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40 lg:hidden"
          />

          {/* Sliding Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 bottom-0 left-0 z-50 w-64 max-w-[80vw] lg:hidden flex flex-col"
          >
            {/* Close Button Inside Drawer Header */}
            <button 
              onClick={onClose}
              className="absolute top-4.5 right-4 z-55 p-1 rounded-lg bg-accent/60 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            
            <Sidebar className="h-full border-r-0 rounded-none shadow-2xl" onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
