import Settings from "../../../models/SETTING/Settings.js";

export const getSettingsByStore = async (req, res) => {
    try {
        console.log("HERE to get settings data");

        const settings = await Settings.findOne({});

        res.status(200).json({
            success: true,
            data: settings,
        });
    } catch (error) {
        console.error("Get Settings Data Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch settings data",
        });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const settings = await Settings.findOneAndUpdate(
            {}, 
            req.body,
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        );

        res.status(200).json({
            success: true,
            message: "Settings updated successfully",
            data: settings,
        });
    } catch (error) {
        console.error("Update Settings Data Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update settings data",
        });
    }
};