
const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    title: String,
    type: String,
    adType: String,

    // Original Post Property form details
    category: String,
    listingType: String,
    contact: {
      name: String,
      email: String,
      mobile: String,
    },

    apartmentType: String,
    bhkType: String,
    furnishing: String,
    commercialType: String,
    plotArea: Number,
    plotType: String,

    city: String,
    location: String,
    locality: String,
    address: String,

    propertyType: String,
    propertyStatus: String,
    newBuilderProjects: Boolean,

    area: Number,
    bathrooms: Number,
    floor: String,
    availableFrom: String,

      price: Number,
    description: String,

    // Multiple property images uploaded to Cloudinary
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          required: true,
        },
      },
    ],

    image: [String],
    imageUrl: String,
    // Phone number from the verified JWT
      ownerName: {
        type: String,
        trim: true,
      },

      ownerPhone: {
        type: String,
        index: true,
      },
      
    // New user submissions require approval
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    strict: false,
  }


);

module.exports = mongoose.model("Property", propertySchema);
