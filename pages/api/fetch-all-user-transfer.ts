import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const db = await connectToDatabase();

    // Fetch only users with role Territory Sales Associate
    // and Status NOT in ['Resigned', 'Terminated'], sorted by Lastname ascending
    const agents = await db
      .collection("users")
      .find({
        Role: "Territory Sales Associate",
        Status: { $nin: ["Resigned", "Terminated"] },
      })
      .project({
        Firstname: 1,
        Lastname: 1,
        ReferenceID: 1,
        profilePicture: 1,
        _id: 0,
      })
      .sort({ Lastname: 1 })  // <-- Sorting by Lastname ascending
      .toArray();

    if (agents.length === 0) {
      return res.status(404).json({ error: "No agents found" });
    }

    res.status(200).json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ error: "Server error fetching agents" });
  }
}
