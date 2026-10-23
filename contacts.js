/**
 * emergencyContacts.js
 * RideGuard — Emergency Contacts screen.
 *
 * Full CRUD: add, edit, delete, set primary.
 * Backed by contactsStorage.js (AsyncStorage).
 *
 * Usage (expo-router):
 *   Place this file at app/contacts.js (or app/(tabs)/contacts.js)
 *   Navigate to it with router.push('/contacts')
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  getContacts,
  addContact,
  updateContact,
  deleteContact,
  setPrimaryContact,
  CONTACTS_LIMIT,
} from '../contactsStorage';

export default function EmergencyContactsScreen() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [relationshipInput, setRelationshipInput] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    const data = await getContacts();
    const sorted = [...data].sort((a, b) =>
      a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1
    );
    setContacts(sorted);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [loadContacts])
  );

  const openAddModal = () => {
    setEditingId(null);
    setNameInput('');
    setPhoneInput('');
    setRelationshipInput('');
    setFormError('');
    setModalVisible(true);
  };

  const openEditModal = (contact) => {
    setEditingId(contact.id);
    setNameInput(contact.name);
    setPhoneInput(contact.phone.replace(/^\+91/, ''));
    setRelationshipInput(contact.relationship || '');
    setFormError('');
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
  };

  const handleSave = async () => {
    setFormError('');
    setSaving(true);

    const result = editingId
      ? await updateContact(editingId, {
          name: nameInput,
          phone: phoneInput,
          relationship: relationshipInput,
        })
      : await addContact({
          name: nameInput,
          phone: phoneInput,
          relationship: relationshipInput,
        });

    setSaving(false);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    setModalVisible(false);
    await loadContacts();
  };

  const handleDelete = (contact) => {
    Alert.alert(
      'Remove contact',
      `Remove ${contact.name} from your emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteContact(contact.id);
            if (!result.success) {
              Alert.alert('Error', result.error);
              return;
            }
            await loadContacts();
          },
        },
      ]
    );
  };

  const handleSetPrimary = async (contact) => {
    if (contact.isPrimary) return;
    const result = await setPrimaryContact(contact.id);
    if (!result.success) {
      Alert.alert('Error', result.error);
      return;
    }
    await loadContacts();
  };

  const renderContact = ({ item }) => (
    <View style={styles.contactCard}>
      <TouchableOpacity
        style={styles.contactMain}
        onPress={() => openEditModal(item)}
        activeOpacity={0.7}
      >
        <View style={styles.contactHeader}>
          <Text style={styles.contactName}>{item.name}</Text>
          {item.isPrimary && (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>PRIMARY</Text>
            </View>
          )}
        </View>
        <Text style={styles.contactPhone}>{item.phone}</Text>
        {!!item.relationship && (
          <Text style={styles.contactRelationship}>{item.relationship}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.contactActions}>
        {!item.isPrimary && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSetPrimary(item)}
          >
            <Text style={styles.actionButtonText}>Make Primary</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item)}
        >
          <Text style={styles.deleteButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D32F2F" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Emergency Contacts</Text>
        <Text style={styles.count}>
          {contacts.length} / {CONTACTS_LIMIT}
        </Text>
      </View>

      <Text style={styles.subtitle}>
        These contacts receive an SMS with your location if a crash is
        detected. The primary contact is alerted first.
      </Text>

      {contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No emergency contacts yet.{'\n'}Add at least one so RideGuard can
            alert someone if you're in a crash.
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContact}
          contentContainerStyle={styles.list}
        />
      )}

      {contacts.length < CONTACTS_LIMIT && (
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Text style={styles.addButtonText}>+ Add Emergency Contact</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingId ? 'Edit Contact' : 'Add Emergency Contact'}
            </Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="e.g. Amma, Dad, Priya"
              maxLength={50}
              editable={!saving}
            />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <View style={styles.phoneInputRow}>
              <Text style={styles.phonePrefix}>+91</Text>
              <TextInput
                style={styles.phoneInput}
                value={phoneInput}
                onChangeText={(text) =>
                  setPhoneInput(text.replace(/[^\d]/g, '').slice(0, 10))
                }
                placeholder="98765 43210"
                keyboardType="number-pad"
                maxLength={10}
                editable={!saving}
              />
            </View>

            <Text style={styles.inputLabel}>Relationship (optional)</Text>
            <TextInput
              style={styles.input}
              value={relationshipInput}
              onChangeText={setRelationshipInput}
              placeholder="e.g. Mother, Friend, Spouse"
              maxLength={30}
              editable={!saving}
            />

            {!!formError && <Text style={styles.errorText}>{formError}</Text>}

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeModal}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingId ? 'Save Changes' : 'Add Contact'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  count: { fontSize: 14, color: '#888', fontWeight: '600' },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 15,
    lineHeight: 22,
  },
  list: { paddingBottom: 16 },
  contactCard: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  contactMain: { marginBottom: 8 },
  contactHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactName: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  primaryBadge: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  primaryBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  contactPhone: { fontSize: 15, color: '#444', marginTop: 2 },
  contactRelationship: { fontSize: 13, color: '#888', marginTop: 2 },
  contactActions: { flexDirection: 'row', gap: 10 },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
  },
  actionButtonText: { fontSize: 13, color: '#333', fontWeight: '600' },
  deleteButton: { backgroundColor: '#FDE7E7' },
  deleteButtonText: { fontSize: 13, color: '#D32F2F', fontWeight: '600' },
  addButton: {
    backgroundColor: '#D32F2F',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
    color: '#1a1a1a',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  phonePrefix: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
    marginRight: 8,
  },
  phoneInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1a1a1a' },
  errorText: { color: '#D32F2F', fontSize: 13, marginBottom: 12 },
  modalButtonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
  },
  cancelButtonText: { color: '#666', fontWeight: '600', fontSize: 15 },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#D32F2F',
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
