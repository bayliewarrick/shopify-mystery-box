import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import { PolarisProvider } from './components/PolarisProvider';
import { ApiProvider } from './contexts/ApiContext';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import MysteryBoxList from './pages/MysteryBoxList';
import MysteryBoxForm from './pages/MysteryBoxForm';
import MysteryBoxDetail from './pages/MysteryBoxDetail';
import Inventory from './pages/Inventory';
import '@shopify/polaris/build/esm/styles.css';

function App() {
  return (
    <PolarisProvider>
      <ApiProvider>
        <Router>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/mystery-boxes" element={<MysteryBoxList />} />
              <Route path="/mystery-boxes/new" element={<MysteryBoxForm />} />
              <Route path="/mystery-boxes/:id" element={<MysteryBoxDetail />} />
              <Route path="/mystery-boxes/:id/edit" element={<MysteryBoxForm />} />
              <Route path="/inventory" element={<Inventory />} />
            </Routes>
          </AppLayout>
        </Router>
      </ApiProvider>
    </PolarisProvider>
  );
}

export default App;
