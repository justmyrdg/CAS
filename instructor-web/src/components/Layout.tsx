import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fff' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '32px 40px', overflow: 'auto' }}>{children}</div>
    </div>
  );
}
