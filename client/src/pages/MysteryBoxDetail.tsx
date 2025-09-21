import React from 'react';
import { Page, Card, Text } from '@shopify/polaris';
import { useParams } from 'react-router-dom';

export default function MysteryBoxDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <Page title={`Mystery Box ${id}`}>
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <Text variant="headingMd" as="h3">Mystery Box Details</Text>
          <p>Box ID: {id}</p>
          <p>Detailed view and management features coming soon!</p>
        </div>
      </Card>
    </Page>
  );
}