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

// Routes
app.get("/", (req, res) => {
  res.send("BB-Matrimony server is running");
});

async function run() {
  try {
    // await client.connect();
    // Database Collections
    const db = client.db("BB-MatrimonyDB");
    const UsersCollection = db.collection("Users");
    const BiodatasCollection = db.collection("Biodatas");
    const MarriagesCollection = db.collection("Marriages");
    const ContactUsCollection = db.collection("ContactUs");

    // verifyToken 
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

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await UsersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

       // users related api
       app.get('/users', async (req, res) => {
      //  app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
        const result = await UsersCollection.find().toArray();
        res.send(result);
      });
  
      app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
  
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'forbidden access' })
        }
  
        const query = { email: email };
        const user = await UsersCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === 'admin';
        }
        res.send({ admin });
      })
  
      app.post('/users', async (req, res) => {
        const user = req.body;
        const query = { email: user.email }
        const existingUser = await UsersCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: 'user already exists', insertedId: null })
        }
        const result = await UsersCollection.insertOne(user);
        res.send(result);
      });
  
      app.patch('/users/admin/:id', async (req, res) => {
      // app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: 'admin'
          }
        }
        const result = await UsersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      })
  
      app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await UsersCollection.deleteOne(query);
        res.send(result);
      })

      

    // Get all the data from the collection
    app.get("/biodatas", async (req, res) => {
      const data = BiodatasCollection.find().sort({ datePosted: -1 });
      const result = await data.toArray();
      res.send(result);
    });

    // Post biodata
    app.post("/biodata", async (req, res) => {
      const biodata = req.body;
      const result = await BiodatasCollection.insertOne(biodata);
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

    // get biodataID everytime +1
    app.get("/biodataID", async (req, res) => {
      const data = await BiodatasCollection.find().sort({ biodataID: -1 }).limit(1).toArray();
      const biodataID = data[0]?.biodataID + 1 || 1;
      res.send({ biodataID });
    });

    // post ContactUs section msg
    app.post("/contactus", async (req, res) => {
      const ContactUsMsg = req.body;
      const result = await ContactUsCollection.insertOne(ContactUsMsg);
      res.send(result);
    });

    //creating Token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      res.cookie("token", token, cookieOptions).send({token});
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
