import React, { useState } from 'react';
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Text,
  Checkbox
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';

export default function MysteryBoxForm() {
  const navigate = useNavigate();
  const api = useApi();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    minValue: 10,
    maxValue: 50,
    minItems: 1,
    maxItems: 5,
    isAutomatic: true
  });

  const handleSubmit = async () => {
    console.log('🚀 handleSubmit called!');
    console.log('📍 Form data:', formData);
    
    if (!formData.name.trim()) {
      console.log('❌ Name validation failed');
      alert('Please enter a name for the mystery box');
      return;
    }

    console.log('✅ Name validation passed, starting API call...');
    setLoading(true);
    try {
      console.log('📞 Calling api.createMysteryBox with:', formData);
      const result = await api.createMysteryBox(formData);
      console.log('✅ API call successful:', result);
      navigate('/mystery-boxes');
    } catch (error) {
      console.error('❌ API call failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
      }
      alert('Failed to create mystery box. Please try again.');
    } finally {
      console.log('🏁 Setting loading to false');
      setLoading(false);
    }
  };

  return (
    <Page
      title="Create Mystery Box"
      primaryAction={{
        content: 'Create Mystery Box',
        loading,
        onAction: handleSubmit,
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: () => navigate('/mystery-boxes'),
        },
      ]}
    >
      <Card>
        <FormLayout>
          <FormLayout.Group>
            <TextField
              label="Mystery Box Name"
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder="e.g., Surprise Tech Bundle"
              autoComplete="off"
            />
          </FormLayout.Group>

          <TextField
            label="Description"
            value={formData.description}
            onChange={(value) => setFormData({ ...formData, description: value })}
            placeholder="Describe what makes this mystery box special..."
            multiline={3}
            autoComplete="off"
          />

          <FormLayout.Group>
            <TextField
              label="Minimum Value ($)"
              type="number"
              value={formData.minValue.toString()}
              onChange={(value) => setFormData({ ...formData, minValue: parseFloat(value) || 0 })}
              autoComplete="off"
            />
            <TextField
              label="Maximum Value ($)"
              type="number"
              value={formData.maxValue.toString()}
              onChange={(value) => setFormData({ ...formData, maxValue: parseFloat(value) || 0 })}
              autoComplete="off"
            />
          </FormLayout.Group>

          <FormLayout.Group>
            <TextField
              label="Minimum Items"
              type="number"
              value={formData.minItems.toString()}
              onChange={(value) => setFormData({ ...formData, minItems: parseInt(value) || 1 })}
              autoComplete="off"
            />
            <TextField
              label="Maximum Items"
              type="number"
              value={formData.maxItems.toString()}
              onChange={(value) => setFormData({ ...formData, maxItems: parseInt(value) || 1 })}
              autoComplete="off"
            />
          </FormLayout.Group>

          <Checkbox
            label="Automatic product selection"
            checked={formData.isAutomatic}
            onChange={(checked) => setFormData({ ...formData, isAutomatic: checked })}
            helpText="Automatically select products based on your criteria"
          />

          <div>
            <Text variant="bodyMd" as="p">
              <strong>Note:</strong> Tag filtering and advanced configuration will be available after creation.
            </Text>
          </div>
        </FormLayout>
      </Card>
    </Page>
  );
}