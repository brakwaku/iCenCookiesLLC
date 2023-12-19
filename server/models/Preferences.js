import mongoose from'mongoose';

const preferencesSchema = new mongoose.Schema({
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

const Preferences = mongoose.model('Preferences', preferencesSchema);

export default Preferences;
