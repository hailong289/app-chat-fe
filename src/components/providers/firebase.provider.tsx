'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { app, messaging, firebaseConfig } from '@/libs/firebase';
import { getToken, onMessage } from 'firebase/messaging';

type FirebaseContextType = {
    app: typeof app;
    messaging: typeof messaging;
    token: string | null;
    message: any;
    requestPermission: () => Promise<void>;
};

const FirebaseContext = createContext<FirebaseContextType | null>(null);

export const useFirebase = () => {
    const ctx = useContext(FirebaseContext);
    if (!ctx) throw new Error('Dùngg useFirebase phải nằm trong FirebaseProvider');
    return ctx;
};

export const FirebaseProvider = ({ children }: { children: React.ReactNode }) => {
    const [token, setToken] = useState<string | null>(null);
    const [message, setMessage] = useState<any>(null);

    useEffect(() => {
        if (!messaging || typeof window === 'undefined') return;

        async function init() {
            try {
                // Đăng ký service worker
                const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                    scope: '/'
                });
                console.log('✅ Đã đăng ký Service Worker:', reg);
                // Đợi service worker ready
                const readyReg = await navigator.serviceWorker.ready;
                console.log('✅ Service Worker ready:', readyReg);

                // Gửi cấu hình Firebase với MessageChannel để nhận phản hồi
                if (readyReg.active) {
                    const messageChannel = new MessageChannel();
                    
                    // Lắng nghe phản hồi từ service worker
                    messageChannel.port1.onmessage = (event) => {
                        if (event.data.success) {
                            console.log('✅ Firebase initialized in service worker successfully');
                        } else {
                            console.error('❌ Error initializing Firebase in service worker:', event.data.error);
                        }
                    };

                    // Gửi cấu hình Firebase
                    const configMsg = { 
                        type: 'INIT_FIREBASE', 
                        config: firebaseConfig 
                    };
                    
                    readyReg.active.postMessage(configMsg, [messageChannel.port2]);
                    console.log('📡 Đã gửi cấu hình Firebase vào SW');
                } else {
                    console.warn('⚠️ Service worker không active');
                }
            } catch (err) {
                console.error('❌ SW register error:', err);
            }

            // // Lắng nghe foreground message (1 lần duy nhất)
            // const unsubscribe = messaging ? onMessage(messaging, (payload) => {
            //     console.log('📩 Foreground message:', payload);    
            // }) : () => {};

            return () => {}; // cleanup nếu component unmount
        }

        init();
    }, []);

    // Hàm xin quyền và lấy token
    async function requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('🚫 Notification permission denied');
                return;
            }
            const registration = await navigator.serviceWorker.ready;
            const t = await getToken(messaging!, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: registration,
            });
            setToken(t);
            console.log('✅ FCM Token:', t);
        } catch (err) {
            console.error('❌ Error getting token', err);
        }
    }

    const value: FirebaseContextType = {
        app,
        messaging,
        token,
        message,
        requestPermission,
    };

    return (
        <FirebaseContext.Provider value={value}>
            {children}
        </FirebaseContext.Provider>
    );
};
