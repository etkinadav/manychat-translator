import crypto from "crypto";
import mongoose, { type Document, type Model } from "mongoose";
import validator from "validator";

const validateLocalStrategyEmail = function (
  this: IUser,
  email: string,
): boolean {
  return (
    (this.provider !== "local" && !this.updated) ||
    validator.isEmail(email, { require_tld: false })
  );
};

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  username: string;
  password: string;
  salt?: string;
  provider: string;
  roles: string[];
  language: string;
  home_printingServices_list: string[];
  home_branches_list: string[];
  updated?: Date;
  hashPassword(password: string): string;
}

export interface IUserModel extends Model<IUser> {}

const userSchema = new mongoose.Schema<IUser>(
  {
    firstName: { type: String, trim: true, default: "" },
    lastName: { type: String, trim: true, default: "" },
    displayName: { type: String, trim: true, default: "" },
    email: {
      type: String,
      index: { unique: true, sparse: true },
      lowercase: true,
      trim: true,
      default: "",
      validate: [validateLocalStrategyEmail, "EMAIL_IS_INVALID"],
    },
    username: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
    },
    home_printingServices_list: { type: [String], default: [""] },
    home_branches_list: { type: [String], default: [""] },
    password: { type: String, default: "" },
    salt: { type: String },
    provider: { type: String, required: true },
    roles: {
      type: [String],
      enum: ["guest", "user", "admin", "st", "bm", "su", "business"],
      default: ["guest"],
      required: true,
    },
    updated: { type: Date },
    language: { type: String, default: "en" },
  },
  { collection: "users" },
);

userSchema.pre("save", function (next) {
  if (this.password && this.isModified("password")) {
    this.salt = crypto.randomBytes(16).toString("base64");
    this.password = this.hashPassword(this.password);
  }
  next();
});

userSchema.pre("validate", function (next) {
  if (!this.firstName.length && this.email) {
    this.firstName = this.email.split("@")[0] ?? "";
    this.displayName = this.firstName;
  }
  if (!this.username.length && this.email) {
    this.username = this.email;
  }
  next();
});

userSchema.methods.hashPassword = function (password: string): string {
  if (this.salt && password) {
    return crypto
      .pbkdf2Sync(password, Buffer.from(this.salt, "base64"), 10000, 64, "SHA1")
      .toString("base64");
  }
  return password;
};

export const User = mongoose.model<IUser, IUserModel>(
  "User",
  userSchema,
  "users",
);
