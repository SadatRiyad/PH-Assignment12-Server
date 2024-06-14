const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.efrqq6z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Let's create a cookie options for both production and local server
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};
//localhost:5000 and localhost:5173 are treated as same site.  so sameSite value must be strict in development server.  in production sameSite will be none
// in development server secure will false .  in production secure will be true

// middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://ph-assignment12-sadatriyad.surge.sh",
      "https://ph-assignment12-sadatriyad.netlify.app",
    ],
    credentials: true,
  })
);

// verifyToken middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log("value inside verifyToken", token);
  if (!token) {
    return res.status(401).send({ error: "Unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ error: "Unauthorized" });
    }
    console.log("value in the token", decoded);
    req.user = decoded;
    next();
  });
};

// Routes
app.get("/", (req, res) => {
  res.send("BB-Matrimony server is running");
});

async function run() {
  // Database Collections
  const db = client.db("BB-MatrimonyDB");
  const UsersCollection = db.collection("Users");
  const BiodatasCollection = db.collection("Biodatas");
  const MarriagesCollection = db.collection("Marriages");

  
// Function to generate biodata ID
const generateBiodataID = async (biodataType) => {
  try {
    // Example: Fetch the last biodata ID from the database and increment it
    // Assuming you have a counter collection named "counters" with a document for biodataID
    const counter = await client
      .db("BB-MatrimonyDB")
      .collection("Biodatas")
      .findOneAndUpdate(
        { _id: "biodataID" },
        { $inc: { sequence_value: 1 } },
        { returnDocument: "after", upsert: true }
      );

    // Format the ID based on biodataType
    const sequenceValue = counter.value.sequence_value.toString().padStart(3, '0'); // Assuming a 3-digit sequence
    const prefix = biodataType === 'Male' ? 'BBM' : 'BBF';
    const biodataID = `${prefix}-${sequenceValue}`;

    return biodataID;
  } catch (error) {
    console.error("Error generating biodata ID:", error);
    throw error;
  }
};

  try {
    // Get all the data from the collection
    app.get("/biodatas", async (req, res) => {
      const data = BiodatasCollection.find().sort({ datePosted: -1 });
      const result = await data.toArray();
      res.send(result);
    });

    // put biodata using email
    app.put("/biodata/:email", async (req, res) => {
      const email = req.params.email;
      const updatedBiodata = req.body;
      const result = await BiodatasCollection.updateOne(
        { email },
        { $set: updatedBiodata },
        { upsert: true }
      );
      res.send(result);
    });

    // get biodata by email
    app.get("/biodata/:email", async (req, res) => {
      const email = req.params.email;
      const data = await BiodatasCollection.find({ email })
        .sort({ datePosted: -1 })
        .toArray();
      res.send(data);
    });

    // count
    app.get("/counters", async (req, res) => {
      try {
        const totalBiodatas = await BiodatasCollection.countDocuments();
        const girlsBiodatas = await BiodatasCollection.countDocuments({
          biodataType: "Female",
        });
        const boysBiodatas = await BiodatasCollection.countDocuments({
          biodataType: "Male",
        });
        const marriagesCompleted = await MarriagesCollection.countDocuments();

        res.json({
          totalBiodatas,
          girlsBiodatas,
          boysBiodatas,
          marriagesCompleted,
        });
      } catch (error) {
        console.error("Error fetching counters:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    //creating Token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });

      res.cookie("token", token, cookieOptions).send({ success: true });
    });

    //clearing Token
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.log);

// Listen for incoming requests
app.listen(port, () => console.log(`Server is running on port ${port}`));
