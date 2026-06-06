import { useState } from 'react'
import { RiEyeLine, RiEyeOffLine } from 'react-icons/ri'

// Password field with a show/hide toggle. Accepts standard input props.
export default function PasswordInput({ className = '', ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className={`pr-10 ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
      </button>
    </div>
  )
}
