import type { FC } from 'react';
import Link from 'next/link';

interface Props {
  type: 'button' | 'submit' | 'link';
  content: string;
  href?: string;
  target?: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

const classNames =
  'rounded border-2 border-indigo-500 px-8 py-2 hover:bg-indigo-500 text-neutral-100 transition-colors cursor-pointer';

const Button: FC<Props> = ({
  type,
  content,
  href = '',
  target = '',
  onClick,
  className = '',
  disabled = false,
}) => {
  return (
    <>
      {(type === 'button' || type === 'submit') && (
        <button
          type={type}
          className={`${classNames} ${className}`}
          onClick={onClick}
          disabled={disabled}
        >
          {content}
        </button>
      )}
      {type === 'link' && (
        <Link href={href} target={target} className={`${classNames} ${className}`}>
          {content}
        </Link>
      )}
    </>
  );
};

export default Button;
