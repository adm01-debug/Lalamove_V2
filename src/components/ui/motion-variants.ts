import { Variants } from 'framer-motion';

// ============= Animation Variants =============

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } }
};

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 } 
  },
  exit: { opacity: 0, y: 20, transition: { duration: 0.2 } }
};

export const fadeDownVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 } 
  },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } }
};

export const slideInLeftVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0, 
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 } 
  },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};

export const slideInRightVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { 
    opacity: 1, 
    x: 0, 
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 } 
  },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } }
};

export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 } 
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
};

export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 } 
  }
};

// Aliases for backward compatibility
export const containerVariants = staggerContainerVariants;
export const itemVariants = staggerItemVariants;

export const headerVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 }
  }
};

export const statsCardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 400, damping: 25 }
  }
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 }
  }
};

export const statsVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 }
  },
  exit: {
    opacity: 0,
    y: 20,
    transition: { duration: 0.2 }
  }
};

export const panelVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 }
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2 }
  }
};

export const variantMap = {
  fade: fadeVariants,
  fadeUp: fadeUpVariants,
  fadeDown: fadeDownVariants,
  slideLeft: slideInLeftVariants,
  slideRight: slideInRightVariants,
  scale: scaleVariants
};
