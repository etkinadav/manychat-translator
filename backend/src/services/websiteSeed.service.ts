import { manychatWebsiteSeed } from "../data/manychatWebsiteSeed";
import { Organization } from "../models/organization";
import { Website } from "../models/website";

/** Dev bootstrap: ensures Manychat exists. Other sites (e.g. WhatsApp) belong in DB only — see docs/seeds/*.json */
export async function seedWebsites(): Promise<void> {
  let manychat = await Website.findOne({ slug: manychatWebsiteSeed.slug });
  if (!manychat) {
    manychat = await Website.create(manychatWebsiteSeed);
    console.log("[seed] created website:", manychat.slug);
  } else {
    manychat.set(manychatWebsiteSeed);
    await manychat.save();
    console.log("[seed] updated website:", manychat.slug);
  }

  const defaultSite = manychat;

  const result = await Organization.updateMany(
    {
      $or: [{ websites: { $exists: false } }, { websites: { $size: 0 } }],
    },
    { $set: { websites: [defaultSite._id] } },
  );
  if (result.modifiedCount > 0) {
    console.log(
      `[seed] linked default site (${defaultSite.slug}) to ${result.modifiedCount} organization(s)`,
    );
  }
}
