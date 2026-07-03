import axios from "axios";
import { config } from "../config/config.js";
import { tiktokCache } from "../utils/cache.js";

export interface TiktokProfileInfo {
  name: string;
  username: string;
  bio: string;
  followers: string;
  following: string;
  likes: string;
  videos: string;
  verified: string;
  isPrivate: string;
  region: string;
  avatarUrl: string;
}

/**
 * Helper function to format numbers to human-readable forms (e.g. 1.2K, 35.6K, 1.4M, 2.1B)
 */
export function formatNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return "0";
  if (num < 1000) return num.toString();
  
  if (num < 1000000) {
    const val = num / 1000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + "K";
  }
  
  if (num < 1000000000) {
    const val = num / 1000000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + "M";
  }
  
  const val = num / 1000000000;
  return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + "B";
}

/**
 * Fetches TikTok user profile info with retries and caching
 * @param username TikTok username (without @ symbol)
 */
export async function getTiktokProfile(username: string): Promise<TiktokProfileInfo> {
  // Check validation of username
  if (!username) {
    throw new Error("Username TikTok tidak boleh kosong.");
  }

  // TikTok usernames can only contain letters, numbers, underscores, and periods
  const isValidUsername = /^[a-zA-Z0-9._]+$/.test(username);
  if (!isValidUsername) {
    throw new Error("Username TikTok hanya boleh berisi huruf, angka, titik, dan garis bawah.");
  }

  // Check cache first
  const cacheKey = `tt_profile_${username.toLowerCase()}`;
  const cachedData = tiktokCache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const maxRetries = 2;
  let attempt = 0;
  let lastError: any = null;

  const url = `https://tikwm.com/api/user/info`;
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  while (attempt <= maxRetries) {
    try {
      const response = await axios.get(url, {
        params: { unique_id: username },
        headers: {
          "User-Agent": userAgent,
          "Accept": "application/json"
        },
        timeout: 10000 // 10 seconds timeout
      });

      const resData = response.data;

      // Handle the cases from TikWM API
      if (resData.code === -1 || (resData.msg && resData.msg.includes("not found"))) {
        throw new Error("Username TikTok tidak ditemukan.");
      }

      if (resData.code !== 0 || !resData.data) {
        throw new Error(resData.msg || "Data tidak ditemukan.");
      }

      const userData = resData.data.user;
      const statsData = resData.data.stats;

      if (!userData) {
        throw new Error("Username TikTok tidak ditemukan.");
      }

      const result: TiktokProfileInfo = {
        name: userData.nickname || "Tidak ada nama",
        username: userData.uniqueId || username,
        bio: userData.signature || "Tidak ada bio",
        followers: formatNumber(statsData?.followerCount || 0),
        following: formatNumber(statsData?.followingCount || 0),
        likes: formatNumber(statsData?.heartCount || statsData?.heart || statsData?.diggCount || 0),
        videos: formatNumber(statsData?.videoCount || 0),
        verified: userData.verified ? "Ya ✅" : "Tidak ❌",
        isPrivate: userData.privateAccount ? "Privat 🔒" : "Publik 🌍",
        region: userData.region || "Tidak diketahui",
        avatarUrl: userData.avatarLarger || userData.avatarMedium || userData.avatarThumb || ""
      };

      // Store in cache for 5 minutes
      tiktokCache.set(cacheKey, result);

      return result;

    } catch (error: any) {
      lastError = error;
      
      // If it's a "Username tidak ditemukan" error, don't retry, just throw immediately
      if (error.message === "Username TikTok tidak ditemukan.") {
        throw error;
      }

      attempt++;
      if (attempt <= maxRetries) {
        // Wait a short delay before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // If we exceeded retries, throw appropriate error
  if (lastError && (lastError.code === "ECONNABORTED" || lastError.message.includes("timeout") || lastError.message.includes("Network Error"))) {
    throw new Error("Terjadi kesalahan saat mengambil data.");
  }

  throw new Error(lastError?.message || "Terjadi kesalahan saat mengambil data.");
}
