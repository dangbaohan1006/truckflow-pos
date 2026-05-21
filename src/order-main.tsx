import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import CustomerOrder from './modules/CustomerOrder.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CustomerOrder />
  </StrictMode>,
);
