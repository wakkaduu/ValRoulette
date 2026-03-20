import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated,
  BackHandler,
  Dimensions,
  Easing, Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView, StyleSheet,
  Switch, Text, TextInput,
  ToastAndroid,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

SplashScreen.preventAutoHideAsync();

const getPosition = (index: number, radius: number) => {
  const angle = (index * (360 / 5) - 90) * (Math.PI / 180);
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
};

export default function HomeScreen() {
  const [allAgents, setAllAgents] = useState<any[]>([]);
  const [squad, setSquad] = useState<any[]>([]);
  const [playerNames, setPlayerNames] = useState(['', '', '', '', '']);
  const [savedSquads, setSavedSquads] = useState<any[]>([]);
  const [isBalanced, setIsBalanced] = useState(true);
  const [loading, setLoading] = useState(true);
  const [appIsReady, setAppIsReady] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useAnimations, setUseAnimations] = useState(true);
  const [expandAbout, setExpandAbout] = useState(false); 
  const [squadLabel, setSquadLabel] = useState("");
  const [themeColor, setThemeColor] = useState('#FF4655');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const lastBackPressed = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const bootRadar = useRef(new Animated.Value(0)).current;
  const podAnims = useRef(playerNames.map(() => new Animated.Value(0))).current;

  // Keyboard Visibility Logic
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Back Button Hardware Handling
  useEffect(() => {
    const backAction = () => {
      if (!showSettings && !showPresets) {
        const now = Date.now();
        if (lastBackPressed.current && now - lastBackPressed.current < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastBackPressed.current = now;
        ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showSettings, showPresets]);

  // Initialization & API Fetch
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
        const json = await res.json();
        const filtered = json.data.filter((a: any, i: number, s: any[]) => 
          i === s.findIndex((t: any) => t.displayName === a.displayName));
        setAllAgents(filtered);
        
        const saved = await AsyncStorage.getItem('@squad_presets');
        if (saved) setSavedSquads(JSON.parse(saved));
        const savedTheme = await AsyncStorage.getItem('@app_theme');
        if (savedTheme) setThemeColor(savedTheme);

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) { console.error(e); } finally { setAppIsReady(true); }
    };
    init();
    Animated.loop(Animated.timing(rotateAnim, { toValue: 1, duration: 60000, useNativeDriver: true })).start();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
      setLoading(false);
      if (useAnimations) startBootSequence();
      else skipBoot();
    }
  }, [appIsReady]);

  const startBootSequence = () => {
    Animated.sequence([
      Animated.timing(bootRadar, { toValue: 1, duration: 800, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      Animated.stagger(80, podAnims.map(anim => Animated.spring(anim, { toValue: 1, friction: 6, useNativeDriver: true })))
    ]).start();
  };

  const skipBoot = () => { bootRadar.setValue(1); podAnims.forEach(anim => anim.setValue(1)); };

  const generateSquad = () => {
    if (isSpinning || allAgents.length === 0) return;
    setIsSpinning(true);
    setSquad([null, null, null, null, null]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animatePlayerStep(0);
  };

  const animatePlayerStep = (index: number) => {
    if (index >= 5) {
      setIsSpinning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    let iterations = 0;
    const maxFlashes = 10;
    Animated.sequence([
      Animated.timing(podAnims[index], { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.spring(podAnims[index], { toValue: 1, friction: 4, useNativeDriver: true })
    ]).start();
    const interval = setInterval(() => {
      const flickerAgent = allAgents[Math.floor(Math.random() * allAgents.length)];
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSquad(prev => {
        const next = [...prev];
        next[index] = { ign: playerNames[index] || `P${index + 1}`, agent: flickerAgent };
        return next;
      });
      iterations++;
      if (iterations >= maxFlashes) {
        clearInterval(interval);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        lockInPlayer(index);
        setTimeout(() => animatePlayerStep(index + 1), 150);
      }
    }, 70);
  };

  const lockInPlayer = (index: number) => {
    let pool = [...allAgents];
    setSquad(prev => {
      const currentLockedUuids = prev.filter((s, idx) => s && idx < index).map(s => s.agent.uuid);
      const filteredPool = pool.filter(a => !currentLockedUuids.includes(a.uuid));
      let finalAgent;
      if (isBalanced) {
        const rolesNeeded = ['Controller', 'Sentinel', 'Duelist', 'Initiator', 'Duelist'];
        finalAgent = filteredPool.find(a => a.role?.displayName === rolesNeeded[index]) || filteredPool[0];
      } else {
        finalAgent = filteredPool[Math.floor(Math.random() * filteredPool.length)];
      }
      const next = [...prev];
      next[index] = { ign: playerNames[index] || `P${index + 1}`, agent: finalAgent };
      return next;
    });
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={themeColor} /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#0F1923' }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <Animated.View style={[styles.radarRing, { borderColor: themeColor + '22', transform: [{ scale: bootRadar }, { rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />

          <View style={styles.headerArea}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSettings(true)}><Text style={styles.iconBtnText}>⚙️</Text></TouchableOpacity>
            <Text style={styles.title}>VALORANT ROULETTE</Text>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowPresets(true)}><Text style={styles.iconBtnText}>📂</Text></TouchableOpacity>
          </View>

          <View style={styles.centerStage}>
            <TouchableOpacity style={styles.coreTouch} onPress={generateSquad} activeOpacity={0.8} disabled={isSpinning}>
              <Animated.View style={[styles.coreGlow, { backgroundColor: themeColor + '22', transform: [{ scale: pulseAnim }] }]} />
              <View style={[styles.coreButton, { backgroundColor: isSpinning ? '#1F2933' : themeColor }]}><Text style={styles.coreText}>{isSpinning ? "---" : "ROLL"}</Text></View>
            </TouchableOpacity>

            {playerNames.map((name, i) => {
              const pos = getPosition(i, width * 0.35);
              const res = squad[i];
              const isCurrentlyLocking = isSpinning && squad[i] && !squad[i+1];
              return (
                <Animated.View key={i} style={[styles.playerPod, { transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale: podAnims[i] }], opacity: podAnims[i] }]}>
                  <View style={[styles.podHex, res && { borderColor: themeColor, borderWidth: 1.5 }, isCurrentlyLocking && { borderColor: '#FFFFFF', borderWidth: 2 }]}>
                    {res ? <Image source={{ uri: res.agent.displayIcon }} style={[styles.agentAvatar, isCurrentlyLocking && { opacity: 0.5 }]} /> : <View style={styles.emptyHex} />}
                  </View>
                  <TextInput style={styles.podInput} placeholder="IDENTIFY" placeholderTextColor="#3e4a56" value={name} onChangeText={(t) => { const n = [...playerNames]; n[i] = t; setPlayerNames(n); }} returnKeyType="done" />
                  {res && <Text style={[styles.agentLabel, { color: themeColor }]}>{res.agent.displayName.toUpperCase()}</Text>}
                </Animated.View>
              );
            })}
          </View>

          {!isKeyboardVisible && (
            <View style={styles.footerArea}>
              <TouchableOpacity style={[styles.balancedBtn, isBalanced && {borderColor: themeColor, backgroundColor: themeColor + '11'}]} onPress={() => setIsBalanced(!isBalanced)}>
                <Text style={[styles.balancedBtnText, isBalanced && {color: themeColor}]}>{isBalanced ? "🛡️ MODE: BALANCED ROLE" : "🎲 MODE: FULL RANDOM"}</Text>
              </TouchableOpacity>
              <View style={styles.saveContainer}>
                  <TextInput style={styles.saveInput} placeholder="TEAM NAME" placeholderTextColor="#3e4a56" value={squadLabel} onChangeText={setSquadLabel} />
                  <TouchableOpacity style={[styles.saveBtn, {backgroundColor: themeColor}]} onPress={async () => {
                    if (playerNames.every(n => n.trim() === "")) return Alert.alert("ERROR", "NO NAMES FOUND");
                    const label = squadLabel || `SQUAD_${savedSquads.length + 1}`;
                    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const newP = { id: Date.now().toString(), label: `${label} (${time})`, names: [...playerNames] };
                    const up = [newP, ...savedSquads];
                    setSavedSquads(up);
                    await AsyncStorage.setItem('@squad_presets', JSON.stringify(up));
                    setSquadLabel("");
                    Alert.alert("SAVED", "ARCHIVED.");
                  }}><Text style={styles.saveBtnText}>SAVE</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      <Modal visible={showSettings} animationType="slide" transparent={true} onRequestClose={() => {setShowSettings(false); setExpandAbout(false);}}>
        <View style={styles.overlay}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>SETTINGS</Text>
            <TouchableOpacity onPress={() => { setShowSettings(false); setExpandAbout(false); }}><Text style={{color: themeColor, fontWeight: 'bold'}}>DONE</Text></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.settingLabel}>SYSTEM INTERFACE THEME</Text>
            <View style={styles.themeRow}>
              {['#FF4655', '#00AD8E', '#BB86FC', '#D3FF00'].map(color => (
                <TouchableOpacity key={color} onPress={async () => { setThemeColor(color); await AsyncStorage.setItem('@app_theme', color); }} style={[styles.themeCircle, { backgroundColor: color, borderWidth: themeColor === color ? 3 : 0, borderColor: 'white' }]} />
              ))}
            </View>
            <View style={styles.settingRow}><Text style={styles.settingTxt}>ENABLE BOOT ANIMATIONS</Text><Switch value={useAnimations} onValueChange={setUseAnimations} trackColor={{ false: "#161d24", true: themeColor }} /></View>
            <TouchableOpacity style={[styles.aboutBtn, { borderColor: themeColor }]} onPress={() => setExpandAbout(!expandAbout)}><Text style={[styles.aboutBtnText, { color: themeColor }]}>ABOUT</Text></TouchableOpacity>
            {expandAbout && (
              <View style={styles.aboutContainer}>
                <Text style={[styles.aboutTitle, { color: themeColor }]}>TACTICAL MISSION</Text>
                <Text style={styles.aboutDesc}>Valorant Roulette is a performance-driven squad management interface designed for competitive 5-stacks.</Text>
                <Text style={[styles.aboutTitle, { color: themeColor, marginTop: 20 }]}>CORE DEVELOPER</Text>
                <View style={styles.devRow}><View style={[styles.devIndicator, { backgroundColor: themeColor }]} /><View style={{flex: 1}}><Text style={styles.devName}>IT Student</Text><Text style={styles.devSchool}>Quezon City University (QCU)</Text><Text style={[styles.devInfo, { color: themeColor }]}>21 y/o Developer • Created for fun!</Text></View></View>
              </View>
            )}
            <TouchableOpacity style={[styles.dangerBtn, {borderColor: themeColor}]} onPress={() => {
              Alert.alert("WIPE DATA?", "DELETE ALL SQUADS?", [{ text: "CANCEL" }, { text: "DELETE", style: "destructive", onPress: async () => { await AsyncStorage.clear(); setSavedSquads([]); setPlayerNames(['','','','','']); setShowSettings(false); }}]);
            }}><Text style={{color: themeColor, fontWeight: 'bold', fontSize: 10}}>RESET SYSTEM MEMORY</Text></TouchableOpacity>
            <View style={styles.versionInfo}><Text style={styles.versionTxt}>V2.6.2 // wakkadu</Text></View>
            <View style={{height: 100}} />
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showPresets} animationType="fade" transparent={true} onRequestClose={() => setShowPresets(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>ARCHIVE</Text>
            <TouchableOpacity onPress={() => setShowPresets(false)}><Text style={{color: themeColor, fontWeight: 'bold'}}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{flex: 1}}>
            {savedSquads.map((s) => (
              <TouchableOpacity key={s.id} style={[styles.fullPresetItem, { borderLeftColor: themeColor }]} onPress={() => { setPlayerNames(s.names); setShowPresets(false); }}>
                <View style={{flex: 1}}><Text style={styles.presetLabelMain}>{s.label}</Text><Text style={styles.presetNamesSub}>{s.names.filter((n: string) => n.trim() !== "").join(" • ")}</Text></View>
                <TouchableOpacity onPress={async () => { const updated = savedSquads.filter(p => p.id !== s.id); setSavedSquads(updated); await AsyncStorage.setItem('@squad_presets', JSON.stringify(updated)); }}><Text style={{color: themeColor, fontSize: 20, fontWeight: 'bold', paddingLeft: 15}}>✕</Text></TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1923', alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, backgroundColor: '#0F1923', justifyContent: 'center', alignItems: 'center' },
  radarRing: { position: 'absolute', width: width * 0.9, height: width * 0.9, borderRadius: width, borderWidth: 1, borderStyle: 'dashed' },
  headerArea: { position: 'absolute', top: 60, width: '100%', paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  title: { color: '#ECE8E1', fontWeight: '900', letterSpacing: 2, fontSize: 16 },
  iconBtn: { padding: 10, backgroundColor: 'rgba(22, 29, 36, 0.8)', borderRadius: 4, width: 45, alignItems: 'center' },
  iconBtnText: { fontSize: 16 },
  centerStage: { width: width, height: width, alignItems: 'center', justifyContent: 'center' },
  coreTouch: { width: 80, height: 80, zIndex: 10, justifyContent: 'center', alignItems: 'center' },
  coreGlow: { position: 'absolute', width: 100, height: 100, borderRadius: 50 },
  coreButton: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#0F1923' },
  coreText: { color: 'white', fontWeight: '900', fontSize: 14 },
  playerPod: { position: 'absolute', alignItems: 'center', width: 100 },
  podHex: { width: 62, height: 62, backgroundColor: '#161d24', borderWidth: 1, borderColor: '#333', transform: [{ rotate: '45deg' }], overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  agentAvatar: { width: 68, height: 68, transform: [{ rotate: '-45deg' }] },
  emptyHex: { width: 15, height: 2, backgroundColor: '#1F2933' },
  podInput: { color: '#ECE8E1', fontSize: 10, fontWeight: 'bold', textAlign: 'center', marginTop: 15, width: 90, height: 30 },
  agentLabel: { position: 'absolute', top: -12, fontSize: 8, fontWeight: '900', backgroundColor: '#0F1923', paddingHorizontal: 4 },
  overlay: { flex: 1, backgroundColor: '#0F1923', paddingTop: 60, paddingHorizontal: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 20 },
  modalTitle: { color: '#ECE8E1', fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  themeRow: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  themeCircle: { width: 35, height: 35, borderRadius: 17.5 },
  settingLabel: { color: '#3e4a56', fontSize: 10, fontWeight: 'bold', marginBottom: 12, letterSpacing: 1 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#161d24' },
  settingTxt: { color: '#ECE8E1', fontSize: 12, fontWeight: 'bold' },
  aboutBtn: { marginTop: 20, padding: 15, borderRadius: 4, borderWidth: 1, alignItems: 'center', backgroundColor: '#161d24' },
  aboutBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  aboutContainer: { backgroundColor: '#111820', padding: 20, marginTop: 10, borderRadius: 4 },
  aboutTitle: { fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 10 },
  aboutDesc: { color: '#8B97A5', fontSize: 12, lineHeight: 20 },
  devRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 15 },
  devIndicator: { width: 4, height: 50, marginRight: 15 },
  devName: { color: '#ECE8E1', fontWeight: 'bold', fontSize: 14 },
  devSchool: { color: '#8B97A5', fontSize: 11 },
  devInfo: { fontSize: 10, marginTop: 4, fontStyle: 'italic' },
  dangerBtn: { marginTop: 40, backgroundColor: 'rgba(255, 70, 85, 0.05)', padding: 15, borderRadius: 4, borderWidth: 1, alignItems: 'center' },
  versionInfo: { marginTop: 40, alignItems: 'center' },
  versionTxt: { color: '#3e4a56', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
  fullPresetItem: { backgroundColor: '#161d24', padding: 20, borderRadius: 4, marginBottom: 12, borderLeftWidth: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  presetLabelMain: { color: '#ECE8E1', fontSize: 18, fontWeight: 'bold' },
  presetNamesSub: { color: '#8B97A5', fontSize: 11, marginTop: 4 },
  footerArea: { position: 'absolute', bottom: 85, width: '75%', gap: 12 },
  balancedBtn: { backgroundColor: '#161d24', padding: 12, borderRadius: 2, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  balancedBtnText: { color: '#ECE8E1', fontWeight: 'bold', fontSize: 11 },
  saveContainer: { flexDirection: 'row', gap: 10 },
  saveInput: { flex: 1, backgroundColor: '#161d24', color: '#ECE8E1', padding: 12, fontSize: 12, borderBottomWidth: 1, borderColor: '#333' },
  saveBtn: { paddingHorizontal: 25, justifyContent: 'center', borderRadius: 2 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 }
});