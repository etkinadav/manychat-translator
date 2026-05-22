import { manychatWebsiteSeed } from "../data/manychatWebsiteSeed";
import { Organization } from "../models/organization";
import { Website } from "../models/website";

/** Ensure Manychat website exists; attach to orgs with no websites. */
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

  const result = await Organization.updateMany(
    {
      $or: [{ websites: { $exists: false } }, { websites: { $size: 0 } }],
    },
    { $set: { websites: [manychat._id] } },
  );
  if (result.modifiedCount > 0) {
    console.log(
      `[seed] linked manychat to ${result.modifiedCount} organization(s)`,
    );
  }
}
