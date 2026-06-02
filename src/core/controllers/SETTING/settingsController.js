import Settings from "../../../models/SETTING/Settings.js";

export const getSettingsByStore = async (req, res) => {
    try {
        console.log("HERE to get settings data")

        const settings = await Settings.findOne({ });

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: "Settings data not found",
            });
        }

        res.json({
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
            req.body,
            { new: true }
        );

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: "Settings not found",
            });
        }

        res.json({
            success: true,
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
