import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  View,
  FlatList,
  Image,
} from 'react-native';
import CameraScreen from './src/CameraScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import RNFS from 'react-native-fs'

type PhotoStatus =
  | 'Pending'
  | 'Uploading'
  | 'Uploaded'
  | 'Failed';

type Photo = {
  id: string,
  path?: string,
  remoteUrl?: string,
  status: PhotoStatus
}

// const API_URL = 'http://192.168.1.3:8000';
const API_URL = "http://10.0.2.2:8000"

const STORAGE_KEY = 'photos';
function App() {
  const [showCamera, setShowCamera] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const isUploading = useRef(false);


  const loadPhotos = async () => {
    try {
      const savedPhotos =
        await AsyncStorage.getItem(STORAGE_KEY);
      console.log('saved ', JSON.stringify(savePhotos))
      if (savedPhotos) {
        setPhotos(JSON.parse(savedPhotos));
      }
    } catch (error) {
      console.error('Error loading photos:', error);
    }
  };

  const savePhotos = async (newPhotos: Photo[]) => {
    console.log('saving the photo ', newPhotos)
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(newPhotos),
      );
      setPhotos(newPhotos)
    } catch (error) {
      console.error('Error saving photos:', error);
    }
  };


  const updatePhotoStatus = async (photoId: string, status: PhotoStatus) => {
    const storePhoto = await AsyncStorage.getItem(STORAGE_KEY)
    if (!storePhoto) {
      return
    }
    const parsedPhoto: Photo[] = JSON.parse(storePhoto)
    const updatePhotos = parsedPhoto.map(photo => {
      if (photo.id === photoId) {
        return {
          ...photo,
          status
        }
      }
      return photo;
    })
    await savePhotos(updatePhotos)
  }

  const markPhotoUploaded = async (photoId: string, remoteUrl: string) => {
    const storedPhotos = await AsyncStorage.getItem(STORAGE_KEY);
    if (!storedPhotos) {
      return
    }
    const parsedphoto: Photo[] = JSON.parse(storedPhotos)
    const updatedPhotos = parsedphoto.map(photo => {
      if (photo.id === photoId) {
        return {
          ...photo,
          path: undefined,
          remoteUrl,
          status: "Uploaded" as PhotoStatus
        }
      }
      return photo
    }
    )
    await savePhotos(updatedPhotos);
  }

  const uploadPhoto = async (photo: Photo) => {
    try {
      if (!photo.path) {
        return
      }
      await updatePhotoStatus(photo.id, 'Uploading');
      const formData = new FormData()
      formData.append('photo',
        {
          uri: `file://${photo.path}`,
          type: 'image/jpeg',
          name: `${photo.id}.jpg`
        } as any
      )
      formData.append('photoId', photo.id);
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await response.json();
    console.log('Upload response:', data);

      if (response.status === 201 || response.status === 409) {
        const remoteUrl = data.url || `${API_URL}/uploads/${photo.id}.jpg`;

        const exists = await RNFS.exists(photo.path);
        if (exists) { await RNFS.unlink(photo.path); }
        await markPhotoUploaded(photo.id, remoteUrl);
        return;
      }
      throw new Error('Upload failed');
    }
    catch (error) {
      await updatePhotoStatus(photo.id, 'Failed');
      console.log(error)
    }
  }

  const uploadPendingPhotos = useCallback(async () => {
    if (isUploading.current) {
      return;
    }
    isUploading.current = true;
    try {
      console.log('uploading current photo')
      const storedPhotos = await AsyncStorage.getItem(STORAGE_KEY);
      if (!storedPhotos) { return; }
      const parsedPhotos: Photo[] = JSON.parse(storedPhotos);
      const pendingPhoto = parsedPhotos.filter(photo => 
        photo.status == "Pending" || photo.status == "Failed"
      );
      console.log( 'Pending photos:', pendingPhoto.length, );

      for (const photo of pendingPhoto) {
        await uploadPhoto(photo)
      }
    } catch (error) {
      console.log(error)
    } finally {
      isUploading.current = false;
    }
  }, [])

  const handlePhotoSaved = async (path: string) => {
    const newPhoto: Photo = {
      id: Date.now().toString(),
      path,
      status: 'Pending',
    };

    const storedPhotos = await AsyncStorage.getItem(STORAGE_KEY)
    const currentPhoto: Photo[] = storedPhotos ? JSON.parse(storedPhotos) : []

    const updatedPhotos = [newPhoto, ...currentPhoto]
    await savePhotos(updatedPhotos)

    const networkStatus = await NetInfo.fetch()
    const isOnline = networkStatus.isConnected && networkStatus.isInternetReachable !== false

    if (isOnline) {
      await uploadPhoto(newPhoto);
    }
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected === true && state.isInternetReachable !== false;
      if (connected) {
        uploadPendingPhotos()
      }
      console.log('Internet connected:', connected);
      setIsConnected(connected);
    });

    return () => {
      unsubscribe();
    };
  }, [uploadPendingPhotos]);

  useEffect(() => {
    loadPhotos();
  }, []);

  if (showCamera) {
    return <CameraScreen
      onPhotoSaved={handlePhotoSaved}
      onClose={() => setShowCamera(false)}
    />;
  }

  const renderPhoto = ({ item }: { item: Photo }) => {
    const imageUri = item.status == 'Uploaded' ? item.remoteUrl : item.path ? `file://${item.path}` : undefined
    return (
      <View style={styles.photoContainer}>
        {imageUri ?
          (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
            />
          )
          : (
            <View style={styles.emptyImage}> <Text>No Image</Text> </View>
          )
        }
        <Text style={styles.status}>{item.status}</Text>
      </View>
    )

  }
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Photos</Text>
      <Text style={styles.networkStatus}> {isConnected ? 'Online' : 'Offline'} </Text>
      <FlatList
        data={photos}
        numColumns={3}
        keyExtractor={item => item.id}
        contentContainerStyle={photos.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No photos yet </Text>}
        renderItem={renderPhoto} />
      <TouchableOpacity
        style={styles.cameraButton}
        onPress={() => setShowCamera(true)}
        activeOpacity={0.8}>
        <Text style={styles.cameraIcon}>📷</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  photoContainer: {
    width: '33.33%',
    padding: 5,
  },
  emptyImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    margin: 20,
  },

  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 16,
    color: '#777',
  },

  photoItem: {
    marginBottom: 20,
    paddingHorizontal: 10,
    marginHorizontal: 5,
    borderWidth: 1
  },

  image: {
    width: '100%',
    height: 150,
    borderRadius: 10,
  },
  networkStatus: {
    marginHorizontal: 20,
    marginTop: 5,
    marginBottom: 10,
    fontSize: 14,
    color: '#666',
  },

  status: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '500',
  },

  cameraButton: {
    position: 'absolute',
    right: 20,
    bottom: 30,

    width: 60,
    height: 60,
    borderRadius: 30,

    justifyContent: 'center',
    alignItems: 'center',

    backgroundColor: '#000',

    zIndex: 999,
    elevation: 999,

  },

  cameraIcon: {
    fontSize: 24,
  },
});

export default App;