"use strict";
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { POST as sendOtpPOST } from '@/app/api/auth/send-otp/route';
import { POST as verifyOtpPOST } from '@/app/api/auth/verify-otp/route';
import { normalizePhoneNumber } from '@/lib/auth';
import { createRequest } from 'node-fetch';

// Mock the 2Factor API
const mockFetch = async (url: string) => {
  const urlObj = new URL(url);
  const phone = urlObj.searchParams.get('SMS') || '';
  const sessionId = urlObj.searchParams.get('Details') || '';

  if (url.includes('/API/V1/test-api-key/SMS/')) {
    if (url.includes('/AUTOGEN3/OTP1')) {
      // Send OTP response
      return {
        status: 200,
        json: () => ({
          Status: 'Success',
          Details: sessionId || 'test-session-id-123',
        }),
      };
    }
    if (url.includes('/SMS/VERIFY/')) {
      // Verify OTP response
      const otp = urlObj.searchParams.get('otp') || '';
      if (otp === '123456') {
        return {
          status: 200,
          json: () => ({
            Status: 'Success',
          }),
        };
      } else {
        return {
          status: 200,
          json: () => ({
            Status: 'Failed',
          }),
        };
      }
    }
  }

  return {
    status: 404,
    json: () => ({ error: 'Not found' }),
  };
};

// Mock request
function createMockRequest(body: any, headers: Record<string, string> = {}) {
  return {
    json: async () => body,
    headers: {
      'x-forwarded-for': 'test-ip-123',
      ...headers,
    },
    method: 'POST',
  } as any;
}

// Mock the global fetch
const originalFetch = global.fetch;
getGlobalFetch = mockFetch;

beforeEach(() => {
  global.fetch = mockFetch as any;
});

afterAll(() => {
  global.fetch = originalFetch as any;
});

describe('Send OTP Endpoint', () => {
  it('should send OTP successfully', async () => {
    const body = { phone: '+919876543210' };
    const request = createMockRequest(body);

    const response = await sendOtpPOST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBeDefined();
    expect(data.phone).toBe('+919876543210');
  });

  it('should return 400 for invalid phone', async () => {
    const body = { phone: '' };
    const request = createMockRequest(body);

    const response = await sendOtpPOST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Phone number is required');
  });

  it('should return 429 for rate limit', async () => {
    const body = { phone: '+919876543210' };
    const request = createMockRequest(body);

    const response1 = await sendOtpPOST(request as any);
    const data1 = await response1.json();

    expect(response1.status).toBe(200);

    const response2 = await sendOtpPOST(request as any);
    const data2 = await response2.json();

    expect(response2.status).toBe(429);
    expect(data2.error).toBe('Too many requests. Please try again later.');
  });
});

describe('Verify OTP Endpoint', () => {
  it('should verify OTP successfully', async () => {
    const body = {
      phone: '+919876543210',
      otp: '123456',
      sessionId: 'test-session-id-123'
    };
    const request = createMockRequest(body);

    const response = await verifyOtpPOST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.email).toContain('+919876543210@phone.bhashahelp.local');
    expect(data.password).toBeDefined();
  });

  it('should return 400 for invalid OTP', async () => {
    const body = {
      phone: '+919876543210',
      otp: 'wrong',
      sessionId: 'test-session-id-123'
    };
    const request = createMockRequest(body);

    const response = await verifyOtpPOST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid OTP');
  });
});