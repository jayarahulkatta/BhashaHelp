import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as sendOtp } from '../send-otp/route';
import { POST as verifyOtp } from '../verify-otp/route';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  checkRateLimitAsync: vi.fn(async () => true),
  normalizePhoneNumber: vi.fn((p) => `+91${p.replace(/\D/g, '').slice(-10)}`)
}));

vi.mock('@/lib/config', () => ({
  getTwoFactorConfig: () => ({ apiKey: 'TEST_API_KEY', otpChannel: 'sms' })
}));

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => {
      if (table === 'otp_sessions') {
        return {
          insert: mockInsert,
          select: mockSelect,
        };
      }
      return {};
    },
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user_123' } }, error: null })
      }
    }
  })
}));

mockSelect.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ single: mockSingle });

global.fetch = vi.fn();

describe('OTP API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('send-otp', () => {
    it('sends SMS successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ Status: 'Success', Details: 'session_123' })
      });
      mockInsert.mockResolvedValueOnce({ error: null });

      const req = new Request('http://localhost/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: '9876543210' }),
        headers: { 'x-forwarded-for': '127.0.0.1' }
      });

      const res = await sendOtp(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.sessionId).toBe('session_123');
      expect(mockInsert).toHaveBeenCalledWith({ session_id: 'session_123', phone: '+919876543210' });
    });

    it('returns user friendly error on send failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ Status: 'Error', Details: 'Invalid template' })
      });

      const req = new Request('http://localhost/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: '9876543210' })
      });

      const res = await sendOtp(req);
      const json = await res.json();
      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to send OTP. Please try again later.');
    });
  });

  describe('verify-otp', () => {
    it('verifies successfully with bound session', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { phone: '+919876543210', created_at: new Date().toISOString() },
        error: null
      });

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ Status: 'Success' })
      });

      const req = new Request('http://localhost/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: '9876543210', otp: '1234', sessionId: 'session_123' }),
        headers: { 'x-forwarded-for': '127.0.0.1' }
      });

      const res = await verifyOtp(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.userId).toBe('user_123');
    });

    it('fails if session bound to different phone', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { phone: '+910000000000', created_at: new Date().toISOString() },
        error: null
      });

      const req = new Request('http://localhost/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: '9876543210', otp: '1234', sessionId: 'session_123' })
      });

      const res = await verifyOtp(req);
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toBe('Session bound to a different phone number.');
    });

    it('fails if OTP is incorrect', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { phone: '+919876543210', created_at: new Date().toISOString() },
        error: null
      });

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ Status: 'Error', Details: 'OTP Mismatch' })
      });

      const req = new Request('http://localhost/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: '9876543210', otp: '0000', sessionId: 'session_123' })
      });

      const res = await verifyOtp(req);
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid OTP. Please try again.');
    });
    
    it('fails if session expired', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { phone: '+919876543210', created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() },
        error: null
      });

      const req = new Request('http://localhost/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: '9876543210', otp: '1234', sessionId: 'session_123' })
      });

      const res = await verifyOtp(req);
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toBe('OTP session expired. Please request a new OTP.');
    });
  });
});
