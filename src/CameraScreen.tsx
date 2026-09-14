import React, { useEffect, useState } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import RNFS from 'react-native-fs';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    usePhotoOutput,
} from 'react-native-vision-camera';

type Props = {
    onClose: () => void;
    onPhotoSaved: (path: string) => Promise<void>;
};

function CameraScreen({ onClose, onPhotoSaved }: Props) {
    const [isCameraReady, setIsCameraReady] = useState(false);
    const device = useCameraDevice('back');
    const photoOutput = usePhotoOutput();
    const { hasPermission, requestPermission } = useCameraPermission();

    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission, requestPermission]);

    const takePhoto = async () => {
        try {
            if (!isCameraReady) {
                console.log('Camera is not ready yet');
                return;
            }
            const { filePath } = await photoOutput.capturePhotoToFile({}, {},);
            console.log('Captured photo:', filePath);
            const photosDirectory = `${RNFS.DocumentDirectoryPath}/photos`;
            const directoryExists = await RNFS.exists(photosDirectory);
            if (!directoryExists) {
                await RNFS.mkdir(photosDirectory);
            }
            const newPath = `${photosDirectory}/photo-${Date.now()}.jpg`;
            await RNFS.moveFile(filePath, newPath);
            await onPhotoSaved(newPath);
            console.log('Photo saved at:', newPath);
            onClose();
        } catch (error) {
            console.error('Error taking photo:', error);
        }
    };
    if (!hasPermission) {
        return (<View style={styles.center}> <Text>Requesting camera permission...</Text> </View>
        );
    }
    if (device == null) {
        return (<View style={styles.center}> <ActivityIndicator size="large" /> </View>
        );
    }
    return (
        <View style={styles.container}>
            <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                outputs={[photoOutput]}
                onConfigured={() => {
                    console.log('Camera configured!');
                    setIsCameraReady(true);
                }}
            />
            <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}>
                <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.captureButton}
                onPress={takePhoto}
                disabled={!isCameraReady}>
                <View style={styles.captureInner} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        width: 45,
        height: 45,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#00000080',
    },
    closeText: {
        color: '#fff',
        fontSize: 24,
    },
    captureButton: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        width: 75,
        height: 75,
        borderRadius: 40,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        borderColor: '#000',
    },
});
export default CameraScreen;
