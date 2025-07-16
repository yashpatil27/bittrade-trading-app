const { query } = require('../config/database');

/**
 * SettingsService - Manages application settings and configuration
 */
const SettingsService = {
  /**
   * Get a setting value by key
   * @param {string} key - Setting key
   * @returns {Promise<number>} - Setting value
   */
  async getSetting(key) {
    try {
      const rows = await query('SELECT value FROM settings WHERE `key` = ?', [key]);
      
      if (rows.length === 0) {
        throw new Error(`Setting '${key}' not found`);
      }
      
      return parseInt(rows[0].value);
    } catch (error) {
      console.error(`Error getting setting '${key}':`, error);
      throw error;
    }
  },

  /**
   * Set a setting value by key
   * @param {string} key - Setting key
   * @param {number} value - Setting value
   * @returns {Promise<void>}
   */
  async setSetting(key, value) {
    try {
      await query(
        'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()',
        [key, value, value]
      );
    } catch (error) {
      console.error(`Error setting '${key}' to '${value}':`, error);
      throw error;
    }
  },

  /**
   * Get all settings as key-value pairs
   * @returns {Promise<Object>} - Object with all settings
   */
  async getAllSettings() {
    try {
      const rows = await query('SELECT `key`, value FROM settings');
      
      const settings = {};
      rows.forEach(row => {
        settings[row.key] = parseInt(row.value);
      });
      
      return settings;
    } catch (error) {
      console.error('Error getting all settings:', error);
      throw error;
    }
  },

  /**
   * Get the current loan interest rate
   * @returns {Promise<number>} - Interest rate as percentage (e.g., 15 for 15%)
   */
  async getLoanInterestRate() {
    try {
      return await this.getSetting('loan_interest_rate');
    } catch (error) {
      console.error('Error getting loan interest rate, using default 15%');
      return 15; // Default fallback
    }
  },

  /**
   * Get all settings for admin interface
   * @returns {Promise<Object>} - Object with all settings
   */
  async getSettings() {
    try {
      const settings = await this.getAllSettings();
      return {
        buy_multiplier: settings.buy_multiplier || 91,
        sell_multiplier: settings.sell_multiplier || 88,
        loan_interest_rate: settings.loan_interest_rate || 15
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      // Return defaults if database error
      return {
        buy_multiplier: 91,
        sell_multiplier: 88,
        loan_interest_rate: 15
      };
    }
  },

  /**
   * Update multiple settings
   * @param {Object} updates - Object with setting updates
   * @returns {Promise<void>}
   */
  async updateSettings(updates) {
    try {
      const promises = [];
      
      if (updates.buy_multiplier !== undefined) {
        promises.push(this.setSetting('buy_multiplier', updates.buy_multiplier));
      }
      
      if (updates.sell_multiplier !== undefined) {
        promises.push(this.setSetting('sell_multiplier', updates.sell_multiplier));
      }
      
      if (updates.loan_interest_rate !== undefined) {
        promises.push(this.setSetting('loan_interest_rate', updates.loan_interest_rate));
      }
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }
};

module.exports = SettingsService;
