// pages/map/index/index.js
import {zoo_points} from "../../../utils/zoo-point";
const app = getApp();
Page({

  /**
   * 页面的初始数据
   */
  data: {
    lat: 0.0,
    lng: 0.0,
    scale: 18,
    markers: [],
    isHidden: false, // 是否隐藏屏幕中心的点标记
    startIdx: -1, // 起点位置在 markers 中的索引
    endIdx: -1, // 终点位置在 markers 中的索引
    targetIdx: -1, // 地图目标点在 markers 中的索引
    uniqueID: 1,  // 设置一个自增的唯一 ID, 给地图中出现的每一个点的 id 属性赋值
    polygons: null,
    polyline: null,
    isDesign: false,
    isNavigate: false,
    navigationText: '',
    color: ['#7bbae4', '#C0C0C0', '#808000', '#32CD32', '#008080', '#FF7F50', '#FFD700', '#FF00FF', '#00FFFF', '#FFA500', '#0000FF', '#FFC0CB'],
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const points = zoo_points.map(item => {
      return {latitude: item.lat, longitude: item.lng}
    });

    // app.sendRequest('GET', '/user/points/all/get', null, null).then((res) => {
    //   const target = res.data;
    //   const mks = [];
    //   for (let i = 0; i < target.length; ++i) {
    //     const marker = this.createNewMarker();
    //     marker.callout.content = target[i].name;
    //     marker.latitude = target[i].lat;
    //     marker.longitude = target[i].lng;
    //     mks.push(marker);
    //   }
    //   this.setData({ markers: mks });
    // });

    const query = wx.createSelectorQuery();
    query.select('#designBtn').boundingClientRect((rect) => {
      if (rect) {
        this.setData({
          halfHeight1: (app.globalData.remainWidth - rect.width) / 2,
        })
      }
    }).exec();
    
    query.select('#targetIcon').boundingClientRect((rect) => {
      if (rect) {
        this.setData({
          centerX: (app.globalData.remainWidth - rect.width) / 2,
          centerY: app.globalData.CustomBar + app.globalData.remainHeight * 0.5 - rect.height * 0.8,
          isHidden: true
        })
      }
    }).exec();

    this.setData({
      lat: 32.09178,
      lng: 118.802874,
      remainHeight: app.globalData.remainHeight, // 设置地图的高度为屏幕剩余高度
      targetTop: app.globalData.CustomBar + 20,
      polygons: [{
        points: points,
        strokeWidth: 3,
        strokeColor: "#ee8138",
        fillColor: "#05b5f540"
      }],
    });
  },

  createID() {
    let id = this.data.uniqueID;
    this.setData({
      uniqueID: id + 1,
    });
    return id;
  },

  createNewMarker() {
    const idx = this.createID();
    return {
      id: idx,
      rid: 0,
      callout: {
        content: "目标点",
        display: "ALWAYS",
        color: "#1e63e9",
        padding: 5,
        borderRadius: 4,
        fontSize: 15
      },
      latitude: 0,
      longitude: 0,
      iconPath: "/map-icons/target.png",
      anchor: {
        x: 0.5,
        y: 0.8
      },
      width: 35,
      height: 35
    };
  },

  /**
   * 
   * @param point 要修改的 marker 对象
   * @param type 类型, 有 'start', 'mid', 'end' 三种
   */
  resetMarker(point, type) {
    point.anchor.x = 0.5;
    point.anchor.y = 0.5;
    if (type == 'start') {
      point.iconPath = "/map-icons/start-point.png";
      point.callout.color = '#13891b';
    } else if (type == 'mid') {
      point.iconPath = "/map-icons/mid-point.png";
      point.callout.color = "#c111b3";
    } else if (type == 'end') {
      point.iconPath = "/map-icons/end-point.png";
      point.callout.color = "#d81e06";
    }
    return point;
  },

  createPolyine() {
    const points = this.data.markers;
    // 判断是否具备起点和终点
    if (points.filter(item => (item.callout.content == '起点' || item.callout.content == '终点')).length < 2) {
      wx.showToast({
        title: '缺少起点或终点',
      })
      return;
    }
    // 处理数据格式以适配后端
    const regions = points.sort((a, b) => {
      if (a.callout.content === '起点') return -1; // "起点"放在最前面
      if (b.callout.content === '起点') return 1;
      if (a.callout.content === '终点') return 1; // "终点"放在最后面
      if (b.callout.content === '终点') return -1;
      return 0; // 其他元素保持相对顺序
    }).map(item => {
      return {
        id: item.rid,
        lat: item.latitude,
        lng: item.longitude
      }
    });

    // 发送数据给后端, 获取到路线信息
    app.sendRequest('POST', '/user/route/get', null, {
      regions: regions,
      type: 'route'
    }).then((res) => {
      if (res.code != 200) {
        wx.showToast({
          title: '路线设计失败',
        });
        return;
      }
      const data = res.data;
      const polyline = [];
      for (let i = 0; i < data.length; ++i) {
        const ways = data[i].ways;
        const param = {};
        param['start'] = data[i].startRid;
        param['end'] = data[i].endRid;
        param['distance'] = [];
        param['duration'] = [];
        param['points'] = [];
        param['leader'] = [];
        for (let j = 0; j < ways.length; ++j) {
          const way = ways[j];
          param['distance'].push(way.distance);
          param['duration'].push(way.duration);
          if (way.reverse == true) {
            way.points.reverse();
          }
          for (let k = 0; k < way.points.length; ++k) {
            const point = way.points[k];
            param['points'].push({
              latitude: point.lat,
              longitude: point.lng
            });
            if ((j == 0 && k == 0) || k == way.points.length - 1) {
              param['leader'].push(param['points']);
            }
          }
        }
        polyline.push(param);
      }
      const color = this.data.color;
      const polylineMks = [];
      for (let i = 0; i < polyline.length; ++i) {
        polyline[i]['width'] = 5;
        polyline[i]['borderWidth'] = 2;
        polyline[i]['arrowLine'] = true;
        polyline[i]['color'] = color[i % (color.length - 1)];
        polyline[i]['borderColor'] = '#2c2c2c';
        polylineMks.push(points.filter(item => item.rid == polyline[i]['start'])[0]);
        if (i == polyline.length - 1) {
          polylineMks.push(points.filter(item => item.rid == polyline[i]['end'])[0]);
        }
      }

      this.setData({ polyline: polyline });
      this.showRouteMessage(polylineMks);
    });
  },

  showRouteMessage(polylineMks) {
    this.setData({ polylineMks: polylineMks, isDesign: true })
  },

  /**
   * 刷新用户当前的定位
   */
  refreshPosition() {
    // 显示加载中提示
    wx.showLoading({
      title: '加载中...',
    });

    app.getPosition(false).then(data => {
      this.setData({
        lat: data.lat,
        lng: data.lng
      })
    }).catch(error => {
      console.log("获取定位时出现错误: " + error);
    }).finally(() => {
      // 隐藏加载中提示
      wx.hideLoading();
    });
  },

  /**
   * 在地图中心展示一个图标, 以帮助用户选择目标地点
   * @param e 地图中心的信息
   */
  showCenter(e) {
    if (e.type == "begin") {
      this.setData({ isHidden: false });
    } else if (e.type == "end") {
      this.setData({ isHidden: true });
    }
  },

  /**
   * 移到到对应的标记点
   */
  moveToMarker: function(e) {
    const idx = e.currentTarget.dataset.index;
    const mks = this.data.markers;
    const targetMarker = mks.filter(item => item.id == idx)[0];
    this.setData({
      showModal: false,
      lat: targetMarker.latitude,
      lng: targetMarker.longitude,
      targetIdx: idx
    });
  },

  /**
   * 决定起点或终点
   */
  decideStartOrEnd(e) {
    const isStart = e.currentTarget.dataset.type == "start";
    const idx = isStart ? this.data.startIdx : this.data.endIdx;
    if (idx == -1 && this.data.targetIdx == -1) { // 地图已经移动, 目标点丧失
      wx.showToast({
        title: '目标点未处于中心',
      })
    }
    else if (idx == -1) { // 可以设置起点或终点
      let mks = this.data.markers;
      mks = mks.map(item => {
        if (item.id == this.data.targetIdx) {
          this.resetMarker(item, e.currentTarget.dataset.type);
          item.callout.content = isStart ? "起点" : "终点";
        }
        return item;
      });
      // 修改地图的点数据
      const temp = this.data.targetIdx;
      let result = {markers: mks, targetIdx: -1};
      isStart ? result.startIdx = temp : result.endIdx = temp;
      this.setData(result);
    }
    else { // 已经设置起点或终点
      let mks = this.data.markers;
      mks = mks.filter(item => item.id != idx);
      let result = {markers: mks};
      isStart ? result.startIdx = -1 : result.endIdx = -1;
      this.setData(result);
    }
  },

  /**
   * 展示中途点列表
   */
  handleExistedMid() {
    this.setData({ showModal: true });
  },

  /**
   * 关闭模态框
   */
  closeMyModal() {
    this.setData({ showModal: false });
  },

  /**
   * 切换到搜索地点的界面
   */
  goToSearch() {
    wx.navigateTo({
      url: "/pages/map/search/search" // 目标页面的路径
    });
  },

  clearAllInMap() {
    this.setData({
      polyline: [],
      markers: [],
      targetIdx: -1,
      startIdx: -1,
      endIdx: -1,
      uniqueID: 1,
      isDesign: false,
      polylineMks: []
    });
    wx.showToast({
      title: '清空地图成功',
    });
  },

  /**
   * 将对应的标记点从地图中移除
   * @param e 一个对象, 存储了要删除的 marker 在数组中的索引
   */
  deletePoint(e) {
    const idx = e.currentTarget.dataset.index || e;
    let mks = this.data.markers;
    mks = mks.filter(item => item.id != idx);
    let result = {markers: mks, showModal: false};
    if (idx == this.data.startIdx) {
      result.startIdx = -1;
    } else if (idx == this.data.endIdx) {
      result.endIdx = -1;
    }
    this.setData(result);
  },

  /**
   * 让地图中心点重定向到对应的点上
   * @param obj search页面传回来的数据
   */
  redirectToPoint(obj) {
    let mks = this.data.markers;
    const result = {
      markers: null,
      isHidden: true,
      lat: obj.lat,
      lng: obj.lng
    };
    let point = this.createNewMarker();
    for (let i = 0; i < mks.length; ++i) {
      if (mks[i].latitude == obj.lat && mks[i].longitude == obj.lng) {
        result['targetIdx'] = mks[i].id;
        point = null;
        break;
      }
    }
    if (point != null) {
      point.latitude = obj.lat;
      point.longitude = obj.lng;
      point.callout.content = obj.name;
      point.rid = obj.id;
      this.resetMarker(point, 'mid');
      mks.push(point);
      result['targetIdx'] = point.id;
    }
    result.markers = mks;
    this.setData(result);
  },

  cancelNavigation: function() {
    this.setData({ polyline: [], isDesign: false, polylineMks: [], isNavigate: false });
    wx.showToast({
      title: '取消路线成功',
    });
  },

  startNavigation: async function() {
    this.setData({ isNavigate: true });
    const polyline = this.data.polyline;
    const textArrs = [];
    const srcMap = {};
    for (let i = 0; i < polyline.length; ++i) {
      const textArr = [];
      const route = polyline[i];
      textArr.push(`现在开始第${i + 1}段路线, 请根据地图前往路线的起点`);
      for (let j = 0; j < route.distance.length; ++j) {
        const distance = route.distance[j];
        textArr.push(`沿着地图道路行驶${distance}米，可到达下一拐角点`);
      }
      textArr.push(`第${i + 1}段路线的导航到此结束, 目标地点就在附近, 请根据地图前往目标点`);
      if (i == polyline.length - 1) {
        textArr.push('导航到此结束, 感谢使用！');
      }
      textArrs.push(textArr);
    }
    app.txtToAudio(textArrs[0][0]).then((src) => {
      app.playAudio(src);
    }).catch((err) => {
      console.log(err);
    });
    this.setData({ navigationText: textArrs[0][0] });
  }
})