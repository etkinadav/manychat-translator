import crypto from "crypto";
import mongoose, { type Document, type Model, type Types } from "mongoose";
import type { OrganizationTermCategory } from "../types/organizationTerms";

export interface IOrganization extends Document {
  name: string;
  language: string;
  translationContext: string;
  terms: OrganizationTermCategory[];
  password: string;
  salt?: string;
  createdBy?: Types.ObjectId | null;
  hashPassword(password: string): string;
}

export interface IOrganizationModel extends Model<IOrganization> {}

const organizationSchema = new mongoose.Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    language: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    translationContext: {
      type: String,
      default: "",
      trim: true,
    },
    terms: {
      type: [
        {
          name: { type: String, required: true, trim: true },
          terms: {
            type: [
              {
                name: { type: String, required: true, trim: true },
                description: { type: String, default: "", trim: true },
                interpretations: {
                  type: [
                    {
                      text: { type: String, default: "", trim: true },
                    },
                  ],
                  default: [],
                },
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
    },
    password: { type: String, required: true },
    salt: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { collection: "organizations", timestamps: true },
);

organizationSchema.pre("save", function (next) {
  if (this.password && this.isModified("password")) {
    this.salt = crypto.randomBytes(16).toString("base64");
    this.password = this.hashPassword(this.password);
  }
  next();
});

organizationSchema.methods.hashPassword = function (password: string): string {
  if (this.salt && password) {
    return crypto
      .pbkdf2Sync(password, Buffer.from(this.salt, "base64"), 10000, 64, "SHA1")
      .toString("base64");
  }
  return password;
};

export const Organization = mongoose.model<IOrganization, IOrganizationModel>(
  "Organization",
  organizationSchema,
  "organizations",
);
