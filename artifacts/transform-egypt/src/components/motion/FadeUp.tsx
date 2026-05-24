import React from 'react';
import { motion, type Variants } from 'framer-motion';

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

interface FadeUpProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'article' | 'header' | 'h2' | 'h3' | 'p' | 'ul' | 'li';
}

/**
 * Reusable scroll-triggered reveal (item B1).
 * - opacity 0→1, translateY 24→0
 * - duration 600ms, ease [0.22, 1, 0.36, 1]
 * - whileInView, fires once at -20% margin
 */
export function FadeUp({ children, className, delay, as = 'div' }: FadeUpProps) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      className={className}
      variants={fadeUpVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-20%' }}
      transition={delay ? { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay } : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * Stagger-children container — pairs with FadeUp.Item.
 * Children stagger by 100ms per item per the brief.
 */
const staggerContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

interface FadeUpGroupProps {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'ul' | 'ol';
}

export function FadeUpGroup({ children, className, as = 'div' }: FadeUpGroupProps) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      className={className}
      variants={staggerContainerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-20%' }}
    >
      {children}
    </Tag>
  );
}

interface FadeUpItemProps {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'li' | 'h2' | 'h3' | 'p';
}

/** Use inside a <FadeUpGroup> — no own initial/whileInView, drives off the parent's stagger. */
export function FadeUpItem({ children, className, as = 'div' }: FadeUpItemProps) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag className={className} variants={fadeUpVariants}>
      {children}
    </Tag>
  );
}
