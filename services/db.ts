import Dexie, { Table } from 'dexie';
import { PackingRecord } from '../types';

class PackRecordDatabase extends Dexie {
  records!: Table<PackingRecord, number>;

  constructor() {
    super('PackRecordDB');
    
    // Define schema
    this.version(2).stores({
      records: '++id, orderId, timestamp, isFlagged, uploadStatus'
    }).upgrade((tx) => {
      // Migration logic: Add new fields to existing records if any
      return tx.table('records').toCollection().modify((record: PackingRecord) => {
        if (!record.uploadStatus) record.uploadStatus = 'completed';
        if (!record.publicUrl) record.publicUrl = `https://track.dobybot-clone.com/v/${record.orderId}`;
      });
    });
  }
}

export const db = new PackRecordDatabase();