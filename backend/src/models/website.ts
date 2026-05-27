import mongoose, { type Document, type Model } from "mongoose";
import type { WebsiteDomProfile } from "../types/websiteDomProfile";

export interface IWebsite extends Document {
  slug: string;
  name: string;
  enabled: boolean;
  urlPatterns: string[];
  /** Gemini prompt label for the other party (e.g. customer, subscriber). */
  othersRole: string;
  domProfile: WebsiteDomProfile;
  profileVersion: number;
  notes: string;
}

export interface IWebsiteModel extends Model<IWebsite> {}

const websiteSchema = new mongoose.Schema<IWebsite>(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    urlPatterns: {
      type: [String],
      required: true,
      default: [],
    },
    othersRole: {
      type: String,
      default: "customer",
      trim: true,
      maxlength: 48,
    },
    domProfile: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    profileVersion: {
      type: Number,
      default: 1,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { collection: "websites", timestamps: true },
);

export const Website = mongoose.model<IWebsite, IWebsiteModel>(
  "Website",
  websiteSchema,
  "websites",
);
