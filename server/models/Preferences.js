import mongoose from'mongoose';

const PreferencesSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    monthlyDelivery: {
        type: Boolean,
        required: true
    },
    doNotAdd: {
        type: [String],
        // required: false
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        // required: false
    }
}, {
    timestamps: true
});

// Prevent user from submitting more than one preference
PreferencesSchema.index({ user: 1 }, { unique: true });

const Preferences = mongoose.model('Preferences', PreferencesSchema);

export default Preferences;
