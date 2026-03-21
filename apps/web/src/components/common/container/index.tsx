'use client';

import type { FC, ReactNode } from 'react';

import styles from './styles.module.scss';

interface Props {
  children?: ReactNode;
  className?: string;
}

const Container: FC<Props> = ({ children, className = '' }) => {
  return <div className={`${styles.container_default} ${className}`}>{children}</div>;
};

export default Container;
