import React, { useState, useEffect, useCallback } from 'react';
import { Page, Card, Text, Button, DataTable, Badge, Spinner, EmptyState, ButtonGroup, Toast } from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { MysteryBox } from '../services/api';

export default function MysteryBoxList() {
  const navigate = useNavigate();
  const api = useApi();
  const [mysteryBoxes, setMysteryBoxes] = useState<MysteryBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchMysteryBoxes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const boxes = await api.getMysteryBoxes();
      setMysteryBoxes(boxes);
    } catch (err) {
      console.error('Error fetching mystery boxes:', err);
      setError('Failed to load mystery boxes');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const generateMysteryBox = async (boxId: string, boxName: string) => {
    try {
      setGenerating(boxId);
      const result = await api.generateBoxInstance(boxId);
      setToastMessage(`Generated mystery box "${boxName}" with ${result.itemCount} items worth $${result.totalValue.toFixed(2)}!`);
    } catch (err) {
      console.error('Error generating mystery box:', err);
      setToastMessage(`Failed to generate mystery box "${boxName}"`);
    } finally {
      setGenerating(null);
    }
  };

  useEffect(() => {
    fetchMysteryBoxes();
  }, [fetchMysteryBoxes]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <Page title="Mystery Boxes">
        <Card>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <Spinner size="large" />
            <Text variant="bodyMd" as="p">Loading mystery boxes...</Text>
          </div>
        </Card>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Mystery Boxes">
        <Card>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <Text variant="headingMd" as="h3">Error</Text>
            <Text variant="bodyMd" as="p">{error}</Text>
            <Button onClick={fetchMysteryBoxes}>Try Again</Button>
          </div>
        </Card>
      </Page>
    );
  }

  if (mysteryBoxes.length === 0) {
    return (
      <Page
        title="Mystery Boxes"
        primaryAction={{
          content: 'Create Mystery Box',
          onAction: () => navigate('/mystery-boxes/new'),
        }}
      >
        <EmptyState
          heading="Create your first mystery box"
          action={{
            content: 'Create Mystery Box',
            onAction: () => navigate('/mystery-boxes/new'),
          }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Mystery boxes are a great way to offer surprise product bundles to your customers.</p>
        </EmptyState>
      </Page>
    );
  }

  const rows = mysteryBoxes.map((box) => [
    box.name,
    box.description || 'No description',
    `${formatCurrency(box.minValue)} - ${formatCurrency(box.maxValue)}`,
    `${box.minItems} - ${box.maxItems}`,
    <Badge tone={box.isActive ? 'success' : 'attention'}>
      {box.isActive ? 'Active' : 'Inactive'}
    </Badge>,
    formatDate(box.createdAt),
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button 
        onClick={() => navigate(`/mystery-boxes/${box.id}`)}
        size="slim"
      >
        View
      </Button>
      <Button 
        onClick={() => generateMysteryBox(box.id, box.name)}
        size="slim"
        tone="success"
        loading={generating === box.id}
        disabled={!box.isActive || generating !== null}
      >
        Generate
      </Button>
    </div>
  ]);

  return (
    <Page
      title="Mystery Boxes"
      primaryAction={{
        content: 'Create Mystery Box',
        onAction: () => navigate('/mystery-boxes/new'),
      }}
    >
      <Card>
        <DataTable
          columnContentTypes={[
            'text',
            'text', 
            'text',
            'text',
            'text',
            'text',
            'text'
          ]}
          headings={[
            'Name',
            'Description',
            'Value Range',
            'Item Range', 
            'Status',
            'Created',
            'Actions'
          ]}
          rows={rows}
        />
      </Card>
      {toastMessage && (
        <Toast
          content={toastMessage}
          onDismiss={() => setToastMessage(null)}
        />
      )}
    </Page>
  );
}