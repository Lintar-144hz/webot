import axios from "axios";
import { config } from "../config/config.js";

export interface TiktokVideoInfo {
  title: string;
  author: string;
  username: string;
  duration: number;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  downloadUrl: string;
}

/**
 * Fetches TikTok video info using public TikWM API.
 * @param url TikTok Video URL
 */
export async function getTiktokInfo(url: string): Promise<TiktokVideoInfo> {
  if (!url) {
    throw new Error("Tolong masukkan URL TikTok yang valid.");
  }

  // Simple validation
  const isTiktok = /tiktok\.com/i.test(url);
  if (!isTiktok) {
    throw new Error("URL bukan merupakan tautan TikTok yang valid.");
  }

  try {
    // Request to TikWM API
    const response = await axios.get(`${config.tiktokApiUrl}`, {
      params: { url: url },
      timeout: 15000 // 15 seconds timeout
    });

    const data = response.data;
    
    if (data.code !== 0 || !data.data) {
      throw new Error(data.msg || "Video tidak ditemukan atau bersifat privat.");
    }

    const video = data.data;

    return {
      title: video.title || "Video TikTok tanpa judul",
      author: video.author?.nickname || "Unknown Author",
      username: video.author?.unique_id || "unknown",
      duration: video.duration || 0,
      thumbnail: video.cover || "https://placehold.co/600x400/png?text=TikTok",
      views: video.play_count || 0,
      likes: video.digg_count || 0,
      comments: video.comment_count || 0,
      shares: video.share_count || 0,
      // HD video without watermark is usually available in 'hdplay' or 'play'
      downloadUrl: video.hdplay || video.play || ""
    };
  } catch (error: any) {
    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${error.message}`);
    }
    throw error;
  }
}
